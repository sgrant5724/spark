"use server";

import { revalidatePath } from "next/cache";
import { withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

/**
 * Workspace-level automation kill switch. Flips globalPause on every automation
 * row for the workspace (pause = halt all scheduled/autonomous runs). Gated on
 * workspace.manage; returns the resulting state so the caller can report it.
 */
export async function toggleGlobalPause(
  formData: FormData,
): Promise<{ paused: boolean }> {
  const slug = String(formData.get("slug"));
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("You don't have permission to change the global pause.");
  }
  const workspaceId = membership.workspaceId;

  const paused = await withWorkspace(db, workspaceId, async (tx) => {
    const rows = await tx.automationSetting.findMany({
      where: { workspaceId },
      select: { globalPause: true },
    });
    // Toggle relative to current state: if anything is paused, resume all.
    const next = !rows.some((r) => r.globalPause);
    await tx.automationSetting.updateMany({
      where: { workspaceId },
      data: { globalPause: next },
    });
    return next;
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: paused ? "automation.global_pause_on" : "automation.global_pause_off",
    entityType: "workspace",
    metadata: { globalPause: paused },
  });
  revalidatePath(`/w/${slug}`);
  return { paused };
}
