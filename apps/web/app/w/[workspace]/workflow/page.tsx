import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";

// M5 — workflow & approvals board. Articles grouped by lifecycle stage;
// each card links into the article workspace where transitions happen.
const COLUMNS: Array<{ title: string; states: string[]; accent: string }> = [
  { title: "Drafting", states: ["drafting"], accent: "border-line" },
  {
    title: "In review",
    states: ["draft_review", "seo_a11y_review", "assets_pending"],
    accent: "border-accent-warn/50",
  },
  { title: "Final approval", states: ["final_approval", "scheduled"], accent: "border-accent-warn" },
  {
    title: "Live",
    states: ["published", "distributed", "analyzing"],
    accent: "border-yellow",
  },
];

const STATE_LABELS: Record<string, string> = {
  drafting: "Drafting",
  draft_review: "Draft review",
  seo_a11y_review: "SEO + A11y",
  assets_pending: "Assets",
  final_approval: "Final approval",
  scheduled: "Scheduled",
  published: "Published",
  distributed: "Distributed",
  analyzing: "Analyzing",
};

export default async function WorkflowPage({
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
      include: {
        citations: { where: { verified: false }, select: { id: true } },
        assets: { select: { kind: true, altText: true } },
      },
    }),
  );

  return (
    <div className="px-8 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Workflow</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Every article and its gate. Automated pre-checks (citations, WCAG,
        assets) surface here; transitions happen inside the article.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = articles.filter((a) => col.states.includes(a.state));
          return (
            <section
              key={col.title}
              className={`rounded-brand border-t-4 ${col.accent} border border-line bg-paper p-3`}
              aria-label={col.title}
            >
              <h2 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/60">
                {col.title} <span>{items.length}</span>
              </h2>
              <div className="space-y-2">
                {items.map((a) => {
                  const missingAssets =
                    !a.assets.some((x) => x.kind === "featured" && x.altText) ||
                    !a.assets.some((x) => x.kind === "og" && x.altText);
                  return (
                    <Link
                      key={a.id}
                      href={`/w/${slug}/content/${a.id}`}
                      className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
                    >
                      <h3 className="text-sm font-semibold leading-snug text-ink">
                        {a.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[0.6rem]">
                        <span className="rounded bg-paper px-1.5 py-0.5 text-accent">
                          {STATE_LABELS[a.state] ?? a.state}
                        </span>
                        {a.citations.length > 0 && (
                          <span className="rounded border border-accent-warn/40 bg-orange/5 px-1.5 py-0.5 text-accent-warn">
                            {a.citations.length} needs source
                          </span>
                        )}
                        {missingAssets &&
                          !["drafting", "draft_review"].includes(a.state) && (
                            <span className="rounded border border-accent-warn/40 bg-orange/5 px-1.5 py-0.5 text-accent-warn">
                              assets missing
                            </span>
                          )}
                      </div>
                    </Link>
                  );
                })}
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-ink/40">Empty</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
