"use server";

import { revalidatePath } from "next/cache";
import { identity } from "@/lib/identity";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { ROLES, can, type RoleName } from "@spark/shared";

/**
 * Invite a user to the workspace by email and assign a role (FR-1).
 * Spark never sets the invitee's password — the user activates their own
 * account. Records an audit entry.
 */
export async function inviteMember(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "") as RoleName;

  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "users.manage")) {
    throw new Error("You do not have permission to invite members.");
  }
  if (!email || !ROLES.includes(role)) {
    throw new Error("A valid email and role are required.");
  }

  // Create the user in an invited (no-password) state if they don't exist.
  const user = await identity.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  await identity.membership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: membership.workspaceId,
        userId: user.id,
      },
    },
    update: { role },
    create: { workspaceId: membership.workspaceId, userId: user.id, role },
  });

  await writeAudit({
    workspaceId: membership.workspaceId,
    actorId: userId,
    action: "user.invited",
    entityType: "membership",
    entityId: user.id,
    metadata: { email, role },
  });

  revalidatePath(`/w/${slug}/members`);
}
