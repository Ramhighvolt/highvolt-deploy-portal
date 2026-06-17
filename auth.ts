import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  extractMicrosoftEmailFields,
  getAllowedEmails,
  toProfileRecord,
} from "@/lib/auth-utils";

// Auth.js v5 uses AUTH_URL; support legacy NEXTAUTH_URL in production (e.g. Vercel).
if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ user, profile }) {
      const allowedEmails = getAllowedEmails();
      const profileRecord = toProfileRecord(profile);
      const {
        userEmail,
        profileEmail,
        preferredUsername,
        upn,
        uniqueName,
        mail,
        selectedEmail,
      } = extractMicrosoftEmailFields(user, profileRecord);

      console.log("Auth allowed emails:", allowedEmails);
      console.log("Microsoft profile keys:", Object.keys(profileRecord || {}));
      console.log("Microsoft login email candidates:", {
        userEmail,
        profileEmail,
        preferredUsername,
        upn,
        uniqueName,
        mail,
        selectedEmail,
      });

      if (!selectedEmail) {
        console.log("Access denied: no Microsoft email found");
        return false;
      }

      if (!allowedEmails.includes(selectedEmail)) {
        console.log("Access denied: email not allowed", selectedEmail);
        return false;
      }

      console.log("Access granted:", selectedEmail);
      return true;
    },
    session({ session, token }) {
      if (session.user) {
        const email =
          typeof token.email === "string" ? token.email : session.user.email;
        if (email) {
          session.user.email = email.trim().toLowerCase();
        }
      }
      return session;
    },
    jwt({ token, user, profile }) {
      const profileRecord = toProfileRecord(profile);
      const { selectedEmail } = extractMicrosoftEmailFields(user, profileRecord);

      if (selectedEmail) {
        token.email = selectedEmail;
      } else if (typeof user?.email === "string") {
        token.email = user.email.trim().toLowerCase();
      }

      return token;
    },
  },
});
