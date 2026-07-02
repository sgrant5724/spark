"use server";

import { revalidatePath } from "next/cache";
import { ArticleState, Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { getLlm } from "@/lib/llm";
import { buildGroundingContext } from "@/lib/grounding";
import { ARTICLE_TRANSITIONS, can, type ArticleStateName, type RoleName } from "@spark/shared";

// Which permission gates each transition TARGET. Everything else needs content.edit.
const TRANSITION_PERMISSION: Partial<Record<ArticleStateName, "content.approve_draft" | "content.approve_final">> = {
  draft_review: "content.approve_draft",
  seo_a11y_review: "content.approve_draft",
  final_approval: "content.approve_draft",
  scheduled: "content.approve_final", // the human review point before anything ships
  published: "content.approve_final",
};

async function requireEditor(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "content.edit")) {
    throw new Error("You don't have permission to edit content.");
  }
  return { userId, workspaceId: membership.workspaceId, role: membership.role };
}

async function snapshotVersion(
  tx: Prisma.TransactionClient,
  articleId: string,
  workspaceId: string,
  userId: string,
) {
  const article = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
  if (!article) return;
  const last = await tx.articleVersion.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
  });
  await tx.articleVersion.create({
    data: {
      workspaceId,
      articleId,
      version: (last?.version ?? 0) + 1,
      title: article.title,
      body: article.body,
      motifMix: article.motifMix as Prisma.InputJsonValue,
      snapshot: { state: article.state } as Prisma.InputJsonValue,
      createdBy: userId,
    },
  });
}

// ---- Generate a draft (FR-6) -------------------------------------------------
export async function generateDraft(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);

  const article = await withWorkspace(db, workspaceId, (tx) =>
    tx.article.findFirst({ where: { id, workspaceId } }),
  );
  if (!article) throw new Error("Article not found.");

  const grounding = await buildGroundingContext(workspaceId, {
    smeProfileId: article.smeProfileId,
  });
  const motifMix = (article.motifMix as Record<string, number>) ?? {};
  const motifLine = Object.entries(motifMix)
    .map(([k, w]) => `${k} (${Math.round(Number(w) * 100)}%)`)
    .join(", ");

  const lengthTarget =
    article.tier && article.tier <= 2 ? "2,000+ words (cornerstone)" : "1,200-1,800 words";

  const system = [
    "You are Spark's article generator writing a blog draft for the organization below.",
    "House template (FR-6): (1) question-reframing intro; (2) sectioned body with H2/H3 in strict order; (3) a 'mindset shift' takeaway section; (4) a CTA aligned to the motif; (5) if any evidence-bearing claims exist, a final 'Sources' H2 listing them.",
    `Voice: blend these motifs — ${motifLine || "informative (100%)"}. The dominant motif sets structure; secondary colors the intro and CTA.`,
    `Length target: ${lengthTarget}.`,
    "Output clean semantic HTML ONLY (no <html>/<head>/<body>, no markdown, no code fences). Start with a <p> intro — the H1/title is provided separately. Use <h2>/<h3> for sections, <ul>/<ol> for lists, <blockquote> for pull-quotes.",
    "Accessibility: descriptive link text, no skipped heading levels, meaningful list structure (WCAG 2.1 AA).",
    "Truthfulness: NEVER invent statistics, studies, quotes, or citations. If a claim would need evidence, either write it without the claim or mark it inline exactly as [NEEDS SOURCE: short description of the claim].",
    "",
    grounding,
  ].join("\n");

  const llm = getLlm();
  const body = await llm.complete({
    system,
    messages: [
      { role: "user", content: `Write the article titled: "${article.title}"${article.audience ? ` for the ${article.audience} audience` : ""}.` },
    ],
    maxTokens: 8192,
  });

  // Extract [NEEDS SOURCE: ...] flags into the citation dossier (verified=false).
  const claims = [...body.matchAll(/\[NEEDS SOURCE:([^\]]+)\]/g)].map((m) => m[1].trim());

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.article.update({
      where: { id },
      data: { body, updatedBy: userId },
    });
    for (const claim of claims) {
      const existing = await tx.citation.findFirst({
        where: { articleId: id, claimText: claim },
      });
      if (!existing) {
        await tx.citation.create({
          data: { workspaceId, articleId: id, claimText: claim, verified: false },
        });
      }
    }
    await snapshotVersion(tx, id, workspaceId, userId);
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "article.generated",
    entityType: "article",
    entityId: id,
    metadata: { provider: llm.provider, needsSource: claims.length },
  });
  revalidatePath(`/w/${slug}/content/${id}`);
}

// ---- Save manual edits ---------------------------------------------------------
export async function saveArticle(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const smeProfileId = String(formData.get("smeProfileId") ?? "") || null;
  if (!title) throw new Error("Title is required.");

  await withWorkspace(db, workspaceId, async (tx) => {
    const exists = await tx.article.findFirst({ where: { id, workspaceId } });
    if (!exists) throw new Error("Article not found.");
    await tx.article.update({
      where: { id },
      data: { title, body: body || null, smeProfileId, updatedBy: userId },
    });
    await snapshotVersion(tx, id, workspaceId, userId);
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "article.edited",
    entityType: "article",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/content/${id}`);
}

// ---- Citation verification ------------------------------------------------------
export async function verifyCitation(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const articleId = String(formData.get("articleId"));
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const { userId, workspaceId } = await requireEditor(slug);
  if (!sourceUrl) throw new Error("A source URL is required to verify a claim.");

  await withWorkspace(db, workspaceId, (tx) =>
    tx.citation.updateMany({
      where: { id, workspaceId },
      data: { sourceUrl, verified: true },
    }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "citation.verified",
    entityType: "citation",
    entityId: id,
    metadata: { sourceUrl },
  });
  revalidatePath(`/w/${slug}/content/${articleId}`);
}

// ---- SEO output generation (FR-7) — deterministic, no invented data ------------
export async function generateSeo(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);

  await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id, workspaceId } });
    if (!article) throw new Error("Article not found.");
    const seoSettings = await tx.seoSettings.findUnique({ where: { workspaceId } });
    const workspace = await tx.workspace.findFirst({ where: { id: workspaceId } });

    // Focus keyword: best keyword whose phrase appears in the title, else tier-best.
    const keywords = await tx.keyword.findMany({
      where: { workspaceId },
      orderBy: { tier: "asc" },
    });
    const titleLc = article.title.toLowerCase();
    const focus =
      keywords.find((k) => titleLc.includes(k.phrase.toLowerCase())) ?? keywords[0] ?? null;
    const secondary = keywords
      .filter((k) => k.id !== focus?.id && (k.audience ?? "") === (article.audience ?? ""))
      .slice(0, 3)
      .map((k) => k.phrase);

    // Internal links: prefer the focus keyword's target page + linked pages.
    const pages = await tx.page.findMany({ where: { workspaceId }, take: 50 });
    const internalLinks: Array<{ url: string; anchor: string }> = [];
    const target = pages.find((p) => p.id === focus?.targetPageId);
    if (target) internalLinks.push({ url: target.url, anchor: target.primaryKeyword ?? target.url });
    for (const p of pages) {
      if (internalLinks.length >= 3) break;
      if (p.id !== target?.id && p.pageType !== "blog") {
        internalLinks.push({ url: p.url, anchor: p.primaryKeyword ?? p.url });
      }
    }

    const { slugify, firstParagraphText, clampText, seoTitle } = await import("@/lib/checks");
    const slugRule = seoSettings?.blogSlugRule ?? "needs_confirmation";
    const path = slugify(article.title);
    const slugValue = slugRule === "blog_prefix" ? `/blog/${path}/` : `/${path}/`;
    const meta = clampText(firstParagraphText(article.body), 155);
    const titleTag = seoTitle(article.title, workspace?.name);

    const publisherNotes = [
      `Focus keyword: ${focus?.phrase ?? "none in workbook — add one in Strategy"}${focus ? ` (T${focus.tier})` : ""}.`,
      `Content tier: ${article.tier ?? "unset"}; audience: ${article.audience ?? "unset"}.`,
      `Internal links: ${internalLinks.map((l) => l.url).join(", ") || "none available"}.`,
      slugRule === "needs_confirmation"
        ? "⚠ Blog slug rule unconfirmed (root vs /blog/) — confirm in Settings before publish."
        : `Slug rule: ${slugRule}.`,
      `Rendered for plugin: ${seoSettings?.plugin ?? "squirrly"}.`,
    ].join("\n");

    await tx.seoOutput.upsert({
      where: { articleId: id },
      update: {
        slug: slugValue,
        title: titleTag,
        titleFallback: clampText(article.title, 60),
        meta,
        focusKeyword: focus?.phrase ?? null,
        secondaryKeywords: secondary as Prisma.InputJsonValue,
        ogTitle: clampText(article.title, 60),
        ogDesc: meta,
        internalLinks: internalLinks as Prisma.InputJsonValue,
        publisherNotes,
      },
      create: {
        workspaceId,
        articleId: id,
        slug: slugValue,
        title: titleTag,
        titleFallback: clampText(article.title, 60),
        meta,
        focusKeyword: focus?.phrase ?? null,
        secondaryKeywords: secondary as Prisma.InputJsonValue,
        ogTitle: clampText(article.title, 60),
        ogDesc: meta,
        internalLinks: internalLinks as Prisma.InputJsonValue,
        publisherNotes,
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "article.seo_generated",
    entityType: "seo_output",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/content/${id}`);
}

// ---- Workflow transitions (FR-10) -----------------------------------------------
export async function transitionArticle(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const target = String(formData.get("target")) as ArticleStateName;
  const { userId, membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const role = membership.role as RoleName;

  await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id, workspaceId } });
    if (!article) throw new Error("Article not found.");

    const allowed = ARTICLE_TRANSITIONS[article.state as ArticleStateName] ?? [];
    if (!allowed.includes(target)) {
      throw new Error(`Cannot move from ${article.state} to ${target}.`);
    }
    const needed = TRANSITION_PERMISSION[target] ?? "content.edit";
    if (!can(role, needed)) {
      throw new Error(`Your role can't move an article to ${target}.`);
    }

    // Automated pre-gates (FR-10): a11y checks + SEO output must exist before
    // an article can leave SEO + A11y review.
    if (target === "assets_pending") {
      const { runA11yChecks } = await import("@/lib/checks");
      const failures = runA11yChecks(article.body, article.title).filter((c) => !c.pass);
      if (failures.length > 0) {
        throw new Error(
          "Accessibility pre-checks failing: " + failures.map((f) => f.label).join("; "),
        );
      }
      const seo = await tx.seoOutput.findUnique({ where: { articleId: id } });
      if (!seo) {
        throw new Error("Generate the SEO fields before approving this stage.");
      }
    }

    // Truthfulness gate: nothing advances past review with unverified claims.
    if (target === "scheduled" || target === "published") {
      const unverified = await tx.citation.count({
        where: { articleId: id, verified: false },
      });
      if (unverified > 0) {
        throw new Error(
          `${unverified} claim(s) still need a verified source before this can ship.`,
        );
      }
    }

    await tx.article.update({
      where: { id },
      data: { state: target as ArticleState, updatedBy: userId },
    });
    await tx.approval.create({
      data: {
        workspaceId,
        articleId: id,
        gate:
          target === "scheduled" || target === "published"
            ? "final_approval"
            : target === "seo_a11y_review"
              ? "draft_review"
              : target === "assets_pending"
                ? "seo_a11y_review"
                : "draft_review",
        reviewerId: userId,
        decision: target === "drafting" ? "changes_requested" : "approved",
        decidedAt: new Date(),
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: `article.state.${target}`,
    entityType: "article",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/content/${id}`);
  revalidatePath(`/w/${slug}/content`);
}
