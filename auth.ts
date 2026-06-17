import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  extractMicrosoftEmailFields,
  getAllowedEmails,
  isEmailAllowed,
  normalizeEmail,
  toProfileRecord,
} from "@/lib/auth-utils";

if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const profileRecord = toProfileRecord(profile);
      const { selectedEmail } = extractMicrosoftEmailFields(user, profileRecord);

      if (!selectedEmail) {
        console.log("Microsoft login denied: no email candidate found");
        return false;
      }

      if (!isEmailAllowed(selectedEmail)) {
        console.log("Microsoft login denied:", selectedEmail);
        return false;
      }

      user.email = selectedEmail;
      if (!user.name && typeof profileRecord?.name === "string") {
        user.name = profileRecord.name;
      }

      console.log("Access granted:", selectedEmail);
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        const profileRecord = toProfileRecord(profile);
        const { selectedEmail } = extractMicrosoftEmailFields(user, profileRecord);
        const email = selectedEmail ?? normalizeEmail(user.email);

        if (email) {
          token.email = email;
        }
        if (user.name) {
          token.name = user.name;
        }
      }

      console.log("JWT email:", token.email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
      }

      console.log("Session email:", session.user?.email);
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      console.log("Microsoft login success:", normalizeEmail(user.email));
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export function getAuthDebugInfo() {
  return {
    allowedEmails: getAllowedEmails(),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasMicrosoftClientId: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID),
    hasMicrosoftClientSecret: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET),
    hasMicrosoftIssuer: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER),
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null,
  };
}
