"use server";

import { revalidatePath } from "next/cache";
import { SocialPlatform, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { getLlm } from "@/lib/llm";
import { buildGroundingContext } from "@/lib/grounding";
import { can } from "@spark/shared";

const PLATFORM_RULES: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn: professional, 900-1,200 chars, 2-3 hashtags at the end, line breaks for scannability, link on its own line.",
  x: "X (Twitter): under 260 chars including the link placeholder, punchy, at most 1-2 hashtags.",
  instagram: "Instagram: conversational, 500-800 chars, emoji welcome, 4-6 hashtags at the end, 'link in bio' style CTA (no raw URL).",
  facebook: "Facebook: friendly, 300-600 chars, 0-2 hashtags, a question to invite comments, link at the end.",
};

async function requireEditor(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "content.edit")) {
    throw new Error("You don't have permission to manage social content.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

// Generate motif-mapped variants for a published article (FR-12). Stub-safe.
export async function generateVariants(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const articleId = String(formData.get("articleId"));
  const { userId, workspaceId } = await requireEditor(slug);

  const prep = await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
    if (!article) throw new Error("Article not found.");
    if (!["published", "distributed", "analyzing"].includes(article.state)) {
      throw new Error("Variants are derived from published articles.");
    }
    // Channel motif mapping: workspace default for channel=social, else Social.
    const channelDefault = await tx.motifDefault.findFirst({
      where: { workspaceId, channel: "social" },
    });
    const motifMix = (channelDefault?.motifMix as Record<string, number>) ?? { social: 1 };
    return { article, motif: Object.keys(motifMix)[0] ?? "social" };
  });

  const grounding = await buildGroundingContext(workspaceId);
  const llm = getLlm();

  const system = [
    "You are Spark's social distribution engine. Derive one social post per platform from the published article below.",
    `Voice: the workspace's '${prep.motif}' motif for social channels.`,
    "Platform conventions:",
    ...Object.values(PLATFORM_RULES).map((r) => `- ${r}`),
    "Where a URL belongs, write exactly {{URL}} — it is substituted at posting time.",
    "Never invent statistics or quotes. No clickbait.",
    'Return ONLY a JSON object: {"linkedin": string, "x": string, "instagram": string, "facebook": string} — no prose, no code fences.',
    "",
    grounding,
  ].join("\n");

  const raw = await llm.complete({
    system,
    messages: [
      {
        role: "user",
        content: `Article title: "${prep.article.title}"\nURL: ${prep.article.publishedUrl ?? "{{URL}}"}\n\nFirst 1500 chars of body:\n${(prep.article.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 1500)}`,
      },
    ],
    maxTokens: 2048,
  });

  let bodies: Partial<Record<SocialPlatform, string>> = {};
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    bodies = JSON.parse(raw.slice(start, end + 1)) as Partial<Record<SocialPlatform, string>>;
  } catch {
    // Stub or unparseable: create clearly-labeled placeholders so the queue works.
    const note = `[STUB — configure an AI provider] Share: ${prep.article.title} {{URL}}`;
    bodies = { linkedin: note, x: note, instagram: note, facebook: note };
  }

  await withWorkspace(db, workspaceId, async (tx) => {
    for (const platform of Object.values(SocialPlatform)) {
      const body = bodies[platform]?.trim();
      if (!body) continue;
      const finalBody = body.replace(/\{\{URL\}\}/g, prep.article.publishedUrl ?? "");
      const existing = await tx.socialVariant.findFirst({
        where: { articleId, workspaceId, platform },
      });
      if (existing) {
        await tx.socialVariant.update({
          where: { id: existing.id },
          data: { body: finalBody, motif: prep.motif, status: "draft" },
        });
      } else {
        await tx.socialVariant.create({
          data: { workspaceId, articleId, platform, body: finalBody, motif: prep.motif, status: "draft" },
        });
      }
    }
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "social.variants_generated",
    entityType: "article",
    entityId: articleId,
    metadata: { provider: llm.provider, motif: prep.motif },
  });
  revalidatePath(`/w/${slug}/social`);
}

// Approve a variant → ready for posting (manual fallback until Uniple confirmed).
export async function approveVariant(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);
  await withWorkspace(db, workspaceId, (tx) =>
    tx.socialVariant.updateMany({ where: { id, workspaceId }, data: { status: "approved" } }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "social.variant_approved",
    entityType: "social_variant",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/social`);
}

// Mark posted (manual posting done) → feeds the Distributed state when all are posted.
export async function markPosted(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);

  await withWorkspace(db, workspaceId, async (tx) => {
    const variant = await tx.socialVariant.findFirst({ where: { id, workspaceId } });
    if (!variant) throw new Error("Variant not found.");
    await tx.socialVariant.update({ where: { id }, data: { status: "posted" } });
    // If every variant for the article is posted, advance published → distributed.
    const remaining = await tx.socialVariant.count({
      where: { articleId: variant.articleId, workspaceId, status: { not: "posted" } },
    });
    if (remaining === 0) {
      await tx.article.updateMany({
        where: { id: variant.articleId, workspaceId, state: "published" },
        data: { state: "distributed" },
      });
    }
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "social.variant_posted",
    entityType: "social_variant",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/social`);
}
