import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Tenant-scoping contract for Row-Level Security.
 *
 * Opens a transaction, pins the per-connection `app.workspace_id`
 * (set_config(..., true) scopes it to THIS transaction so it never leaks across
 * a pooled connection), then runs `fn`. The RLS policies in prisma/rls.sql then
 * restrict every read/write to that workspace.
 *
 * The client passed in MUST be connected as a non-owner role (APP_DATABASE_URL)
 * for RLS to apply — the schema owner bypasses RLS by design.
 */
export async function withWorkspace<T>(
  client: PrismaClient,
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
    return fn(tx);
  });
}
