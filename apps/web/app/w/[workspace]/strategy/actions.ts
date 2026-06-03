"use server";

import { revalidatePath } from "next/cache";
import { KeywordIntent, PageType, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";

async function requireStrategist(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "strategy.manage")) {
    throw new Error("You don't have permission to manage strategy.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

const audit = (
  workspaceId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) => writeAudit({ workspaceId, actorId, action, entityType, entityId, metadata });

// ---- Keywords (FR-4; volume/difficulty are NEVER entered by hand) ----------
export async function createKeyword(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const phrase = String(formData.get("phrase") ?? "").trim();
  if (!phrase) throw new Error("Phrase is required.");
  const tierRaw = parseInt(String(formData.get("tier") ?? ""), 10);
  const tier = tierRaw >= 1 && tierRaw <= 4 ? tierRaw : 4;
  const service = String(formData.get("service") ?? "").trim() || null;
  const audience = String(formData.get("audience") ?? "").trim() || null;
  const intentRaw = String(formData.get("intent") ?? "");
  const intent = (Object.values(KeywordIntent) as string[]).includes(intentRaw)
    ? (intentRaw as KeywordIntent)
    : null;
  const targetPageId = String(formData.get("targetPageId") ?? "") || null;

  const created = await withWorkspace(db, workspaceId, (tx) =>
    tx.keyword.create({
      data: { workspaceId, phrase, tier, service, audience, intent, targetPageId },
    }),
  );
  await audit(workspaceId, userId, "keyword.created", "keyword", created.id, { phrase, tier });
  revalidatePath(`/w/${slug}/strategy`);
}

export async function deleteKeyword(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireStrategist(slug);
  await withWorkspace(db, workspaceId, (tx) =>
    tx.keyword.deleteMany({ where: { id, workspaceId } }),
  );
  await audit(workspaceId, userId, "keyword.deleted", "keyword", id);
  revalidatePath(`/w/${slug}/strategy`);
}

// ---- Pages (site inventory + page mapping) ---------------------------------
export async function createPage(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const url = String(formData.get("url") ?? "").trim();
  if (!url) throw new Error("URL is required.");
  const typeRaw = String(formData.get("pageType") ?? "");
  const pageType = (Object.values(PageType) as string[]).includes(typeRaw)
    ? (typeRaw as PageType)
    : PageType.blog;
  const primaryKeyword = String(formData.get("primaryKeyword") ?? "").trim() || null;

  const created = await withWorkspace(db, workspaceId, (tx) =>
    tx.page.create({ data: { workspaceId, url, pageType, primaryKeyword } }),
  );
  await audit(workspaceId, userId, "page.created", "page", created.id, { url, pageType });
  revalidatePath(`/w/${slug}/strategy`);
}

export async function deletePage(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireStrategist(slug);
  await withWorkspace(db, workspaceId, async (tx) => {
    // Null out keyword targets pointing here (no cascade), then delete the page
    // (page_links cascade on delete).
    await tx.keyword.updateMany({
      where: { workspaceId, targetPageId: id },
      data: { targetPageId: null },
    });
    await tx.page.deleteMany({ where: { id, workspaceId } });
  });
  await audit(workspaceId, userId, "page.deleted", "page", id);
  revalidatePath(`/w/${slug}/strategy`);
}

// ---- Internal-link graph edges (FR-4 / FR-7) -------------------------------
export async function createLink(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const fromPageId = String(formData.get("fromPageId") ?? "");
  const toPageId = String(formData.get("toPageId") ?? "");
  const anchorText = String(formData.get("anchorText") ?? "").trim() || null;
  if (!fromPageId || !toPageId || fromPageId === toPageId) {
    throw new Error("Pick two different pages.");
  }
  await withWorkspace(db, workspaceId, async (tx) => {
    // Guard both pages belong to the workspace.
    const count = await tx.page.count({
      where: { workspaceId, id: { in: [fromPageId, toPageId] } },
    });
    if (count !== 2) throw new Error("Both pages must belong to this workspace.");
    await tx.pageLink.upsert({
      where: { fromPageId_toPageId: { fromPageId, toPageId } },
      update: { anchorText },
      create: { workspaceId, fromPageId, toPageId, anchorText },
    });
  });
  await audit(workspaceId, userId, "page_link.created", "page_link", undefined, {
    fromPageId,
    toPageId,
  });
  revalidatePath(`/w/${slug}/strategy`);
}

export async function deleteLink(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireStrategist(slug);
  await withWorkspace(db, workspaceId, (tx) =>
    tx.pageLink.deleteMany({ where: { id, workspaceId } }),
  );
  await audit(workspaceId, userId, "page_link.deleted", "page_link", id);
  revalidatePath(`/w/${slug}/strategy`);
}
