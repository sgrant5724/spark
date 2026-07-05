"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArticleState, Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { ARTICLE_TRANSITIONS, can, type ArticleStateName, type RoleName } from "@spark/shared";

// Expected, user-fixable gate failures — surfaced as an inline banner on the
// article page (via ?error=) instead of an error screen.
class GateError extends Error {}

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

// ---- Generate a draft (FR-6) — core shared with the pipeline run --------------
export async function generateDraft(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireEditor(slug);

  // FR-14: never disruptively rewrite a protected top performer.
  const guard = await withWorkspace(db, workspaceId, (tx) =>
    tx.article.findFirst({ where: { id, workspaceId }, select: { protectedFromRewrite: true } }),
  );
  if (guard?.protectedFromRewrite) {
    redirect(
      `/w/${slug}/content/${id}?error=${encodeURIComponent("This article is protected from rewrites (top performer). Unprotect it in Analytics first.")}`,
    );
  }

  const { generateDraftCore } = await import("@/lib/pipeline");
  const result = await generateDraftCore(workspaceId, userId, id);

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "article.generated",
    entityType: "article",
    entityId: id,
    metadata: { provider: result.provider, needsSource: result.needsSource },
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

// ---- Assets (FR-8): featured + branded OG required; infographic every 3rd -------
export async function addAsset(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const articleId = String(formData.get("articleId"));
  const kindRaw = String(formData.get("kind"));
  const url = String(formData.get("url") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim();
  const { userId, workspaceId } = await requireEditor(slug);

  if (!["featured", "og", "inbody"].includes(kindRaw)) throw new Error("Invalid asset kind.");
  const kind = kindRaw as "featured" | "og" | "inbody";
  if (!url) throw new Error("Image URL is required.");
  if (!altText) throw new Error("Alt text is required for every meaningful image (FR-8).");

  await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
    if (!article) throw new Error("Article not found.");
    const spec = await tx.imageSpec.findUnique({ where: { workspaceId } });
    const width = kind === "og" ? spec?.ogW ?? 1200 : spec?.featuredW ?? 1920;
    const height = kind === "og" ? spec?.ogH ?? 630 : spec?.featuredH ?? 1080;

    // One asset per kind for featured/og — replace on re-add.
    if (kind !== "inbody") {
      await tx.asset.deleteMany({ where: { articleId, workspaceId, kind } });
    }
    await tx.asset.create({
      data: {
        workspaceId,
        articleId,
        kind,
        url,
        width,
        height,
        altText,
        status: "ready",
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "asset.added",
    entityType: "asset",
    entityId: articleId,
    metadata: { kind },
  });
  revalidatePath(`/w/${slug}/content/${articleId}`);
}

export async function attachInfographic(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const articleId = String(formData.get("articleId"));
  const { userId, workspaceId } = await requireEditor(slug);

  await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
    if (!article) throw new Error("Article not found.");
    const existing = await tx.asset.findFirst({
      where: { articleId, workspaceId, kind: "inbody", url: { contains: "infographic.svg" } },
    });
    if (existing) return;
    await tx.asset.create({
      data: {
        workspaceId,
        articleId,
        kind: "inbody",
        url: `/w/${slug}/content/${articleId}/infographic.svg`,
        altText: `Infographic: key takeaways from "${article.title}"`,
        status: "ready",
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "asset.infographic_attached",
    entityType: "asset",
    entityId: articleId,
  });
  revalidatePath(`/w/${slug}/content/${articleId}`);
}

// ---- WordPress publish (FR-11) ---------------------------------------------------
export async function publishToWordPress(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role as RoleName, "content.approve_final")) {
    throw new Error("Only final approvers can publish.");
  }
  const workspaceId = membership.workspaceId;

  const { decryptJson } = await import("@/lib/crypto");
  const { WpRestAdapter } = await import("@/lib/wordpress");
  type Enc = import("@/lib/crypto").Encrypted;
  type Creds = import("@/lib/wordpress").WpCredentials;

  let publishError: string | null = null;
  let result: { postId: number; link: string } | null = null;
  try {
    // Assemble everything inside the tenant scope; publish outside the txn.
    const prep = await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({
      where: { id, workspaceId },
      include: { seoOutput: true, assets: true, citations: true },
    });
    if (!article) throw new Error("Article not found.");
    if (article.state !== "scheduled") {
      throw new Error("Article must be in 'scheduled' state (final approved) to publish.");
    }
    if (article.citations.some((c) => !c.verified)) {
      throw new Error("Unverified claims remain — publishing is blocked.");
    }
    const featured = article.assets.find((a) => a.kind === "featured" && a.altText);
    const og = article.assets.find((a) => a.kind === "og" && a.altText);
    if (!featured || !og) throw new Error("Featured + OG images with alt text required (FR-8).");
    if (!article.seoOutput) throw new Error("Generate SEO fields before publishing.");

    const conn = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
    });
    if (!conn || conn.status !== "connected" || !conn.credentials) {
      throw new Error("No connected WordPress site — connect one in Settings → Integrations.");
    }

    const infographic = article.assets.find(
      (a) => a.kind === "inbody" && a.url?.includes("infographic.svg"),
    );
    let contentHtml = article.body ?? "";
    if (infographic) {
      // Note: route URL is workspace-internal; WP needs a public asset. Embed the
      // figure with the app URL — replaced by media sideload in a later pass.
      const appUrl = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
      contentHtml += `\n<figure><img src="${appUrl}${infographic.url}" alt="${infographic.altText}" width="1200"/><figcaption>Key takeaways</figcaption></figure>`;
    }

    const slugSegment =
      article.seoOutput.slug?.split("/").filter(Boolean).pop() ?? article.id;

    // Plugin-specific SEO meta (FR-7): Squirrly / Rank Math / Yoast field keys.
    const seoSettings = await tx.seoSettings.findUnique({ where: { workspaceId } });
    const { pluginMetaPayload } = await import("@/lib/seo-plugins");
    const meta = pluginMetaPayload(seoSettings?.plugin ?? "squirrly", {
      title: article.seoOutput.title,
      meta: article.seoOutput.meta,
      focusKeyword: article.seoOutput.focusKeyword,
      canonical: article.seoOutput.canonical,
      ogTitle: article.seoOutput.ogTitle,
      ogDesc: article.seoOutput.ogDesc,
    });

      return {
        creds: decryptJson<Creds>(conn.credentials as unknown as Enc),
        payload: {
          title: article.title,
          slug: slugSegment,
          contentHtml,
          excerpt: article.seoOutput.meta ?? "",
          status: "publish" as const,
          featuredImageUrl: featured.url ?? undefined,
          featuredImageAlt: featured.altText ?? undefined,
          meta,
        },
      };
    });

    const adapter = new WpRestAdapter(prep.creds);
    result = await adapter.publish(prep.payload);
  } catch (e) {
    publishError = e instanceof Error ? e.message : "Publishing failed.";
  }
  if (publishError || !result) {
    redirect(
      `/w/${slug}/content/${id}?error=${encodeURIComponent(publishError ?? "Publishing failed.")}`,
    );
  }

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.article.update({
      where: { id },
      data: {
        state: "published",
        wordpressPostId: BigInt(result.postId),
        publishedUrl: result.link,
        updatedBy: userId,
      },
    });
    await tx.approval.create({
      data: {
        workspaceId,
        articleId: id,
        gate: "final_approval",
        reviewerId: userId,
        decision: "approved",
        reason: "Published to WordPress",
        decidedAt: new Date(),
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "article.published_wordpress",
    entityType: "article",
    entityId: id,
    metadata: { postId: result.postId, link: result.link },
  });
  revalidatePath(`/w/${slug}/content/${id}`);
  revalidatePath(`/w/${slug}/content`);
}

// ---- Workflow transitions (FR-10) -----------------------------------------------
export async function transitionArticle(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const target = String(formData.get("target")) as ArticleStateName;
  const { userId, membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const role = membership.role as RoleName;

  let gateError: string | null = null;
  try {
    await withWorkspace(db, workspaceId, async (tx) => {
      const article = await tx.article.findFirst({ where: { id, workspaceId } });
      if (!article) throw new GateError("Article not found.");

      const allowed = ARTICLE_TRANSITIONS[article.state as ArticleStateName] ?? [];
      if (!allowed.includes(target)) {
        throw new GateError(`Cannot move from ${article.state} to ${target}.`);
      }
      const needed = TRANSITION_PERMISSION[target] ?? "content.edit";
      if (!can(role, needed)) {
        throw new GateError(`Your role can't move an article to ${target}.`);
      }

      // Automated pre-gates (FR-10): a11y checks + SEO output must exist before
      // an article can leave SEO + A11y review.
      if (target === "assets_pending") {
        const { runA11yChecks } = await import("@/lib/checks");
        const failures = runA11yChecks(article.body, article.title).filter((c) => !c.pass);
        if (failures.length > 0) {
          throw new GateError(
            "Accessibility pre-checks failing: " + failures.map((f) => f.label).join("; "),
          );
        }
        const seo = await tx.seoOutput.findUnique({ where: { articleId: id } });
        if (!seo) {
          throw new GateError("Generate the SEO fields before approving this stage.");
        }
      }

      // Truthfulness gate: nothing advances past review with unverified claims.
      if (target === "scheduled" || target === "published") {
        const unverified = await tx.citation.count({
          where: { articleId: id, verified: false },
        });
        if (unverified > 0) {
          throw new GateError(
            `${unverified} claim(s) still need a verified source before this can ship.`,
          );
        }
        // FR-8 gate: featured AND branded OG asset, each with alt text.
        const assets = await tx.asset.findMany({ where: { articleId: id, workspaceId } });
        const featured = assets.find((a) => a.kind === "featured" && a.altText);
        const og = assets.find((a) => a.kind === "og" && a.altText);
        if (!featured || !og) {
          throw new GateError(
            "A featured image AND a branded OG image (each with alt text) are required before this can ship (FR-8).",
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
  } catch (e) {
    if (e instanceof GateError) {
      gateError = e.message;
    } else {
      throw e;
    }
  }
  if (gateError) {
    redirect(`/w/${slug}/content/${id}?error=${encodeURIComponent(gateError)}`);
  }

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
