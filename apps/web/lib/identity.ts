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

// Omit datasources when DATABASE_URL is absent (build time) so construction
// never throws; it only connects when a request actually uses it.
const url = process.env.DATABASE_URL;

export const identity =
  globalForPrisma.sparkIdentity ??
  new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production")
  globalForPrisma.sparkIdentity = identity;
