"use server";

import { revalidatePath } from "next/cache";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";

/**
 * Mark every unread in-app notification in the workspace as read. Membership is
 * re-checked and the write runs inside the workspace scope (RLS-enforced).
 */
export async function markNotificationsRead(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;

  await withWorkspace(db, workspaceId, (tx) =>
    tx.notification.updateMany({
      where: { workspaceId, readAt: null },
      data: { readAt: new Date() },
    }),
  );
  revalidatePath(`/w/${slug}`, "layout");
}
