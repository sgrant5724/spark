import { RefreshCw, Sparkles } from "lucide-react";
import { withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { Button } from "@/components/ui";
import { approveVariant, generateVariants, markPosted } from "./actions";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-line bg-paper text-accent",
  approved: "border-accent-warn/40 bg-orange/5 text-accent-warn",
  scheduled: "border-yellow bg-yellow/20 text-ink",
  posted: "border-yellow bg-yellow/20 text-ink",
  failed: "border-accent-warn bg-orange/10 text-accent-warn",
};

export default async function SocialPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const canEdit = can(membership.role, "content.edit");

  const articles = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.article.findMany({
      where: {
        workspaceId: membership.workspaceId,
        state: { in: ["published", "distributed", "analyzing"] },
      },
      orderBy: { updatedAt: "desc" },
      include: { socialVariants: { orderBy: { platform: "asc" } } },
    }),
  );

  return (
    <div className="px-8 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Social</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Motif-mapped variants derived from published articles (FR-12). Posting
        runs manually for now — copy each approved variant to its network. The
        Uniple integration takes over scheduling once its API is confirmed.
      </p>

      {articles.length === 0 ? (
        <p className="text-ink/70">
          No published articles yet — variants are derived after publishing.
        </p>
      ) : (
        <div className="space-y-6">
          {articles.map((a) => (
            <section key={a.id} className="rounded-brand border border-line bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">{a.title}</h2>
                  {a.publishedUrl && (
                    <a href={a.publishedUrl} target="_blank" className="break-all text-xs text-accent underline">
                      {a.publishedUrl}
                    </a>
                  )}
                </div>
                {canEdit && (
                  <form action={generateVariants}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="articleId" value={a.id} />
                    <Button
                      type="submit"
                      size="sm"
                      leftIcon={
                        a.socialVariants.length ? (
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        )
                      }
                    >
                      {a.socialVariants.length ? "Regenerate variants" : "Generate variants"}
                    </Button>
                  </form>
                )}
              </div>

              {a.socialVariants.length === 0 ? (
                <p className="text-xs text-ink/50">No variants yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {a.socialVariants.map((v) => (
                    <article key={v.id} className="rounded-lg border border-line p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">
                          {PLATFORM_LABELS[v.platform] ?? v.platform}
                          {v.motif && <span className="ml-2 font-normal text-ink/40">motif: {v.motif}</span>}
                        </span>
                        <span className={`rounded border px-1.5 py-0.5 text-[0.6rem] ${STATUS_STYLES[v.status] ?? ""}`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-ink/80">{v.body}</p>
                      {canEdit && (
                        <div className="mt-2 flex gap-2 border-t border-paper pt-2">
                          {v.status === "draft" && (
                            <form action={approveVariant}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={v.id} />
                              <button className="text-[0.65rem] font-semibold text-accent underline">Approve</button>
                            </form>
                          )}
                          {v.status === "approved" && (
                            <form action={markPosted}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={v.id} />
                              <button className="text-[0.65rem] font-semibold text-accent underline">
                                Mark posted
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
