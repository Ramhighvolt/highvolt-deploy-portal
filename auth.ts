import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { extractMicrosoftEmailFields, isEmailAllowed, normalizeEmail, toProfileRecord } from "@/lib/auth-utils";

if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) process.env.AUTH_URL = process.env.NEXTAUTH_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  })],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, profile }) {
      const { selectedEmail } = extractMicrosoftEmailFields(user, toProfileRecord(profile));
      if (!isEmailAllowed(selectedEmail)) return false;
      user.email = selectedEmail;
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        const { selectedEmail } = extractMicrosoftEmailFields(user, toProfileRecord(profile));
        const email = selectedEmail ?? normalizeEmail(user.email);
        if (email) token.email = email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
});