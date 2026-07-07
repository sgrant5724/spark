import "server-only";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { resolveLlm } from "@/lib/llm-settings";
import { buildGroundingContext } from "@/lib/grounding";

/**
 * Core draft generation (FR-6), shared by the manual "Generate draft" button
 * and the one-click pipeline run. Returns the count of [NEEDS SOURCE] flags.
 */
export async function generateDraftCore(
  workspaceId: string,
  userId: string,
  articleId: string,
): Promise<{ provider: string; needsSource: number }> {
  const article = await withWorkspace(db, workspaceId, (tx) =>
    tx.article.findFirst({ where: { id: articleId, workspaceId } }),
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

  const llm = await resolveLlm(workspaceId);
  const body = await llm.complete({
    system,
    messages: [
      {
        role: "user",
        content: `Write the article titled: "${article.title}"${article.audience ? ` for the ${article.audience} audience` : ""}.`,
      },
    ],
    maxTokens: 8192,
  });

  const claims = [...body.matchAll(/\[NEEDS SOURCE:([^\]]+)\]/g)].map((m) => m[1].trim());

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: { body, updatedBy: userId },
    });
    for (const claim of claims) {
      const existing = await tx.citation.findFirst({
        where: { articleId, claimText: claim },
      });
      if (!existing) {
        await tx.citation.create({
          data: { workspaceId, articleId, claimText: claim, verified: false },
        });
      }
    }
    const last = await tx.articleVersion.findFirst({
      where: { articleId },
      orderBy: { version: "desc" },
    });
    const fresh = await tx.article.findFirst({ where: { id: articleId, workspaceId } });
    await tx.articleVersion.create({
      data: {
        workspaceId,
        articleId,
        version: (last?.version ?? 0) + 1,
        title: fresh?.title ?? article.title,
        body,
        motifMix: (fresh?.motifMix ?? {}) as Prisma.InputJsonValue,
        snapshot: { state: fresh?.state ?? article.state } as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
  });

  return { provider: llm.provider, needsSource: claims.length };
}
