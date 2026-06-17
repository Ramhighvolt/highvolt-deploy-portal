import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  getAllowedEmails,
  resolveMicrosoftLoginEmail,
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
      const profileRecord =
        profile && typeof profile === "object"
          ? (profile as Record<string, unknown>)
          : null;

      console.log("Auth allowed emails:", allowedEmails);
      console.log("Microsoft profile keys:", Object.keys(profileRecord || {}));

      const email = resolveMicrosoftLoginEmail(user, profileRecord);
      console.log("Microsoft login email candidate:", email);

      if (!email) {
        console.log("No email found in Microsoft profile");
        return false;
      }

      if (!allowedEmails.includes(email)) {
        console.log("Email not allowed:", email);
        return false;
      }

      return true;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
      }
      return session;
    },
    jwt({ token, user, profile }) {
      const profileRecord =
        profile && typeof profile === "object"
          ? (profile as Record<string, unknown>)
          : null;

      const email = resolveMicrosoftLoginEmail(user, profileRecord);
      if (email) {
        token.email = email;
      } else if (user?.email) {
        token.email = normalizeTokenEmail(user.email);
      }
      return token;
    },
  },
});

function normalizeTokenEmail(email: string): string {
  return email.trim().toLowerCase();
}
