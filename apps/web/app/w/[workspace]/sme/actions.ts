"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";

// Structured intake fields (FR-3) — the former 10-question interview, captured once.
const FIELDS = [
  "experience",
  "expertise",
  "opinions",
  "caseStudies",
  "examples",
  "alwaysSay",
  "neverSay",
] as const;

async function requireSmeManager(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "sme.manage")) {
    throw new Error("You don't have permission to manage SME profiles.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

function buildProfile(formData: FormData): Record<string, string> {
  const profile: Record<string, string> = {};
  for (const f of FIELDS) profile[f] = String(formData.get(f) ?? "").trim();
  return profile;
}

export async function createSmeProfile(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireSmeManager(slug);
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  if (!name) throw new Error("Name is required.");

  const created = await withWorkspace(db, workspaceId, (tx) =>
    tx.smeProfile.create({
      data: {
        workspaceId,
        name,
        title,
        profile: buildProfile(formData) as Prisma.InputJsonValue,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      },
    }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "sme_profile.created",
    entityType: "sme_profile",
    entityId: created.id,
    metadata: { name },
  });
  revalidatePath(`/w/${slug}/sme`);
  redirect(`/w/${slug}/sme`);
}

export async function updateSmeProfile(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireSmeManager(slug);
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  if (!name) throw new Error("Name is required.");

  await withWorkspace(db, workspaceId, async (tx) => {
    const existing = await tx.smeProfile.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error("Profile not found.");
    await tx.smeProfile.update({
      where: { id },
      data: {
        name,
        title,
        profile: buildProfile(formData) as Prisma.InputJsonValue,
        version: existing.version + 1, // version profiles over time (FR-3)
        updatedBy: userId,
      },
    });
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "sme_profile.updated",
    entityType: "sme_profile",
    entityId: id,
    metadata: { name },
  });
  revalidatePath(`/w/${slug}/sme`);
  redirect(`/w/${slug}/sme`);
}
