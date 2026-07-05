import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Edge-safe base config. Imported by middleware (Edge runtime), so it must NOT
 * pull in Prisma, bcrypt, or other Node-only modules. The Credentials provider
 * and all DB-touching callbacks (jwt/signIn) live in auth.ts (Node runtime).
 *
 * OAuth providers are listed here (they're edge-safe); auth.ts prepends
 * Credentials for the full server/route-handler instance.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [Google, MicrosoftEntraID],
  callbacks: {
    // Gate /w/* and /agency — Auth.js redirects unauthorized requests to signIn.
    authorized({ auth, request }) {
      const p = request.nextUrl.pathname;
      const isProtected = p.startsWith("/w") || p.startsWith("/agency");
      if (!isProtected) return true;
      return Boolean(auth?.user);
    },
    // Reads the persisted token (set by the jwt callback in auth.ts) — no DB.
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = String(token.userId);
      }
      return session;
    },
  },
};
