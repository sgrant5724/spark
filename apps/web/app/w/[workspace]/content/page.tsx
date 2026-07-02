import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { ARTICLE_STATES } from "@spark/shared";

const STATE_LABELS: Record<string, string> = {
  idea: "Idea",
  approved_idea: "Approved idea",
  drafting: "Drafting",
  draft_review: "Draft review",
  seo_a11y_review: "SEO + A11y review",
  assets_pending: "Assets pending",
  final_approval: "Final approval",
  scheduled: "Scheduled",
  published: "Published",
  distributed: "Distributed",
  analyzing: "Analyzing",
};

const stateColor = (s: string) =>
  s === "published" || s === "distributed" || s === "scheduled" || s === "analyzing"
    ? "bg-yellow/20 text-ink border-yellow"
    : s.includes("review") || s === "final_approval" || s === "assets_pending"
      ? "bg-orange/10 text-orange border-orange/40"
      : "bg-paper text-blue border-lightblue";

export default async function ContentPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);

  const articles = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.article.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { updatedAt: "desc" },
      include: { citations: { where: { verified: false }, select: { id: true } } },
    }),
  );

  return (
    <div className="px-8 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Content</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Articles moving through the pipeline. Approve ideas on the Ideas board to
        create new drafts.
      </p>

      {articles.length === 0 ? (
        <p className="text-ink/70">
          No articles yet — approve an idea on the{" "}
          <Link href={`/w/${slug}/ideas`} className="text-blue underline">
            Ideas board
          </Link>{" "}
          to start one.
        </p>
      ) : (
        <ul className="space-y-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/w/${slug}/content/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-brand border border-lightblue bg-white px-4 py-3 hover:border-blue"
              >
                <span className="font-medium text-ink">{a.title}</span>
                <span className="flex items-center gap-2">
                  {a.citations.length > 0 && (
                    <span className="rounded-full border border-orange/40 bg-orange/5 px-2 py-0.5 text-[0.65rem] text-orange">
                      {a.citations.length} needs source
                    </span>
                  )}
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs ${stateColor(a.state)}`}
                  >
                    {STATE_LABELS[a.state] ?? a.state}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-1.5" aria-hidden>
        {ARTICLE_STATES.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5 text-[0.62rem] text-ink/40">
            {STATE_LABELS[s]}
            {i < ARTICLE_STATES.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
