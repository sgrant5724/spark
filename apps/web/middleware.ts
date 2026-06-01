import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware built from the base config only (no Prisma/bcrypt). The
// `authorized` callback in auth.config.ts gates /w/* and redirects to /login.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/w/:path*"],
};
