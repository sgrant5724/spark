import "server-only";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";

/**
 * Append a per-workspace audit entry (NFR Auditability). Writes through the app
 * role inside the workspace scope so RLS verifies the row belongs to the tenant.
 * `actorId` is null for system/AI actions.
 */
export async function writeAudit(params: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const {
    workspaceId,
    actorId = null,
    action,
    entityType,
    entityId = null,
    metadata = {},
  } = params;

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  });
}
