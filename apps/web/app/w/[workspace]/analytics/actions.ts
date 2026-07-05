"use server";

import { revalidatePath } from "next/cache";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";

async function requireStrategist(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "strategy.manage")) {
    throw new Error("You don't have permission to manage analytics.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

const intOrNull = (v: FormDataEntryValue | null) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
const floatOrNull = (v: FormDataEntryValue | null) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Record a performance snapshot for an article (FR-14). Manual entry now; the
 * GSC/GA4 connectors populate the same `analytics_snapshots` table on a
 * schedule once connected. Never invents metrics — values are operator-entered
 * or integration-sourced.
 */
export async function recordSnapshot(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const articleId = String(formData.get("articleId"));
  const { userId, workspaceId } = await requireStrategist(slug);

  const data = {
    impressions: intOrNull(formData.get("impressions")),
    clicks: intOrNull(formData.get("clicks")),
    position: floatOrNull(formData.get("position")),
    sessions: intOrNull(formData.get("sessions")),
    conversions: intOrNull(formData.get("conversions")),
  };
  if (Object.values(data).every((v) => v === null)) {
    throw new Error("Enter at least one metric.");
  }

  await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
    if (!article) throw new Error("Article not found.");
    await tx.analyticsSnapshot.create({
      data: { workspaceId, articleId, capturedAt: new Date(), ...data },
    });
    // Entering performance data implies the article is being tracked — move it
    // into the analyzing state once it's live.
    if (["published", "distributed"].includes(article.state)) {
      await tx.article.update({ where: { id: articleId }, data: { state: "analyzing" } });
    }
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "analytics.snapshot_recorded",
    entityType: "article",
    entityId: articleId,
    metadata: data,
  });
  revalidatePath(`/w/${slug}/analytics`);
}

/** Toggle "protect from rewrite" for a top-performing post (FR-14). */
export async function toggleProtect(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const articleId = String(formData.get("articleId"));
  const next = String(formData.get("protect")) === "true";
  const { userId, workspaceId } = await requireStrategist(slug);

  await withWorkspace(db, workspaceId, (tx) =>
    tx.article.updateMany({
      where: { id: articleId, workspaceId },
      data: { protectedFromRewrite: next },
    }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: next ? "analytics.article_protected" : "analytics.article_unprotected",
    entityType: "article",
    entityId: articleId,
  });
  revalidatePath(`/w/${slug}/analytics`);
}
