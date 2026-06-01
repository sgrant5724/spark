import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { authConfig } from "@/auth.config";
import { identity } from "@/lib/identity";

/**
 * Full Auth.js (NextAuth v5) instance — Node runtime only (route handler +
 * server components/actions). Extends the edge-safe base in auth.config.ts with
 * the Credentials provider and the DB-touching jwt/signIn callbacks.
 *
 * Guardrails (FR-1 / security):
 *  - Spark NEVER auto-creates accounts. SSO sign-in only succeeds if a user with
 *    that email was already invited (exists in `users`).
 *  - Passwords are set by the invitee, never by Spark. `authorize` only verifies.
 *  - MFA (TOTP) is enforced when enabled on the account.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" },
      },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await identity.user.findUnique({ where: { email } });
        // No password set => invited but not yet activated. Cannot sign in.
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (user.mfaEnabled) {
          const token = String(creds?.totp ?? "").trim();
          if (
            !user.mfaSecret ||
            !token ||
            !authenticator.verify({ token, secret: user.mfaSecret })
          ) {
            return null;
          }
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    ...authConfig.providers,
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Invite-only for SSO: reject any email we haven't already provisioned.
    signIn: async ({ user, account }) => {
      if (account?.provider === "credentials") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      const existing = await identity.user.findUnique({ where: { email } });
      return Boolean(existing);
    },
    jwt: async ({ token, user, account }) => {
      // Credentials.authorize returns OUR db id; trust it directly.
      if (account?.provider === "credentials" && user && "id" in user && user.id) {
        token.userId = user.id;
      }
      // For SSO (or any token missing it), resolve our internal id by email —
      // the OAuth provider's `user.id` is NOT our user id.
      if (!token.userId && token.email) {
        const u = await identity.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
        });
        if (u) token.userId = u.id;
      }
      return token;
    },
  },
});
