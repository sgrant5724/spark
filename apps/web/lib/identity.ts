import "server-only";
import { PrismaClient } from "@spark/db";

/**
 * Control-plane (identity) client.
 *
 * Connects as the schema OWNER (DATABASE_URL), which bypasses RLS. Used ONLY for
 * inherently cross-workspace identity resolution: "who is this user", "which
 * workspaces do they belong to". This is the one place that may read across
 * tenants — and only for the *signed-in* user's own memberships. All actual
 * tenant CONTENT must go through `db` + `withWorkspace`, never this client.
 */
const globalForPrisma = globalThis as unknown as {
  sparkIdentity?: PrismaClient;
};

export const identity =
  globalForPrisma.sparkIdentity ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production")
  globalForPrisma.sparkIdentity = identity;
