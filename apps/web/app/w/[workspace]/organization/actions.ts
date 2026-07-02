"use server";

import { revalidatePath } from "next/cache";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";

/**
 * Save the workspace's Organization Profile — "what this client does." This is
 * the grounding context injected into every AI output for the workspace
 * (idea discovery, drafts, social variants), so relevance depends on it.
 */
export async function saveOrgProfile(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("You don't have permission to edit the organization profile.");
  }
  const workspaceId = membership.workspaceId;

  // services/audiences come in as newline-separated "name — blurb" lines.
  const parseLines = (v: FormDataEntryValue | null) =>
    String(v ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...rest] = line.split("—");
        return { name: name.trim(), blurb: rest.join("—").trim() };
      });

  const data = {
    description: String(formData.get("description") ?? "").trim() || null,
    industry: String(formData.get("industry") ?? "").trim() || null,
    services: parseLines(formData.get("services")) as Prisma.InputJsonValue,
    audiences: parseLines(formData.get("audiences")) as Prisma.InputJsonValue,
    differentiators: String(formData.get("differentiators") ?? "").trim() || null,
    credentials: String(formData.get("credentials") ?? "").trim() || null,
    toneNotes: String(formData.get("toneNotes") ?? "").trim() || null,
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim() || null,
    updatedBy: userId,
  };

  await withWorkspace(db, workspaceId, (tx) =>
    tx.orgProfile.upsert({
      where: { workspaceId },
      update: data,
      create: { workspaceId, ...data },
    }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "org_profile.updated",
    entityType: "org_profile",
  });
  revalidatePath(`/w/${slug}/organization`);
}
