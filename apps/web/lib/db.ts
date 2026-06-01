import "server-only";
import { PrismaClient } from "@spark/db";

/**
 * Tenant content-plane client. Connects as the non-owner app role so Postgres
 * Row-Level Security applies. Use ONLY inside `withWorkspace(...)` so a workspace
 * is pinned for the transaction (see @spark/db). Never query tenant tables on
 * this client outside a workspace scope.
 */
const globalForPrisma = globalThis as unknown as { sparkDb?: PrismaClient };

export const db =
  globalForPrisma.sparkDb ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.sparkDb = db;
