import "server-only";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";

/**
 * Write a per-workspace in-app notification. Like writeAudit, this goes through
 * the app role inside the workspace scope so RLS confirms tenant ownership.
 * `recipientId` null = a workspace-wide notice (shown to every member).
 */
export async function createNotification(params: {
  workspaceId: string;
  type: string;
  payload?: Record<string, unknown>;
  recipientId?: string | null;
}): Promise<void> {
  const { workspaceId, type, payload = {}, recipientId = null } = params;
  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.notification.create({
      data: {
        workspaceId,
        type,
        recipientId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  });
}
