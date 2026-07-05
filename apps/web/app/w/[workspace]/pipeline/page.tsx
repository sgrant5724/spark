import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { runA11yChecks } from "@/lib/checks";
import { ARTICLE_TRANSITIONS, type ArticleStateName } from "@spark/shared";
import { transitionArticle, generateSeo } from "../content/actions";

// The nine-stage pipeline as the navigation spine. Ideate lives on the Ideas
// board; the article-bearing stages are operated here in a three-pane view.
const STAGES: Array<{ key: string; label: string; states: ArticleStateName[] }> = [
  { key: "draft", label: "Draft", states: ["drafting"] },
  { key: "review", label: "Review", states: ["draft_review", "seo_a11y_review"] },
  { key: "assets", label: "Assets", states: ["assets_pending"] },
  { key: "approve", label: "Approve", states: ["final_approval", "scheduled"] },
  { key: "publish", label: "Published", states: ["published"] },
  { key: "social", label: "Social", states: ["distributed"] },
  { key: "analyze", label: "Analyze", states: ["analyzing"] },
];

const TARGET_LABELS: Record<string, string> = {
  drafting: "↩ Back to drafting",
  draft_review: "Send to draft review",
  seo_a11y_review: "Approve → SEO + A11y",
  assets_pending: "Approve → assets",
  final_approval: "Send to final approval",
  scheduled: "✓ Final approve",
  published: "Publish",
  distributed: "Mark distributed",
  analyzing: "Move to analyzing",
};

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams?: { stage?: string; article?: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;

  const data = await withWorkspace(db, workspaceId, async (tx) => {
    const byState = await tx.article.groupBy({
      by: ["state"],
      where: { workspaceId },
      _count: { _all: true },
    });
    const ideas = await tx.idea.count({ where: { workspaceId, status: "discovered" } });
    return { byState, ideas };
  });

  const stageCount = (states: ArticleStateName[]) =>
    data.byState.filter((b) => states.includes(b.state as ArticleStateName)).reduce((a, b) => a + b._count._all, 0);

  // Pick the active stage: requested, else first non-empty, else Review.
  const requested = STAGES.find((s) => s.key === searchParams?.stage);
  const firstNonEmpty = STAGES.find((s) => stageCount(s.states) > 0);
  const stage = requested ?? firstNonEmpty ?? STAGES[1];

  const queue = await withWorkspace(db, workspaceId, (tx) =>
    tx.article.findMany({
      where: { workspaceId, state: { in: stage.states } },
      orderBy: { updatedAt: "asc" },
      include: { citations: { where: { verified: false }, select: { id: true } } },
    }),
  );

  const selectedId = searchParams?.article && queue.some((a) => a.id === searchParams.article)
    ? searchParams.article
    : queue[0]?.id;

  const selected = selectedId
    ? await withWorkspace(db, workspaceId, (tx) =>
        tx.article.findFirst({
          where: { id: selectedId, workspaceId },
          include: { citations: true, seoOutput: true, assets: true },
        }),
      )
    : null;

  // Gate inspector state for the selected article.
  const a11y = selected ? runA11yChecks(selected.body, selected.title) : [];
  const unverified = selected?.citations.filter((c) => !c.verified) ?? [];
  const hasFeatured = selected?.assets.some((x) => x.kind === "featured" && x.altText) ?? false;
  const hasOg = selected?.assets.some((x) => x.kind === "og" && x.altText) ?? false;
  const targets = selected
    ? (ARTICLE_TRANSITIONS[selected.state as ArticleStateName] ?? []).filter((t) => TARGET_LABELS[t])
    : [];
  const bodyPreview = (selected?.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);

  const stageHref = (key: string) => `/w/${slug}/pipeline?stage=${key}`;

  return (
    <div className="flex min-h-[calc(100vh)] flex-col">
      {/* Stage rail */}
      <div className="flex items-stretch gap-1.5 overflow-x-auto bg-nav px-4 py-3" role="tablist" aria-label="Pipeline stages">
        <Link href={`/w/${slug}/ideas`} className="flex min-w-[92px] flex-col rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5">
          <span className="truncate text-[0.56rem] uppercase tracking-wide text-cyan/80">Ideate</span>
          <span className="text-lg font-bold tabular-nums text-white">{data.ideas}</span>
        </Link>
        {STAGES.map((s) => {
          const active = s.key === stage.key;
          const n = stageCount(s.states);
          return (
            <Link
              key={s.key}
              href={stageHref(s.key)}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-w-[92px] flex-col rounded-lg border px-2.5 py-1.5 " +
                (active ? "border-transparent bg-orange" : "border-white/12 bg-white/5")
              }
            >
              <span className={"truncate text-[0.56rem] uppercase tracking-wide " + (active ? "text-white/85" : "text-white/50")}>
                {s.label}
              </span>
              <span className="text-lg font-bold tabular-nums text-white">{n}</span>
            </Link>
          );
        })}
      </div>

      {/* Three panes */}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_300px]">
        {/* Queue */}
        <aside className="border-b border-lightblue bg-white p-3 md:border-b-0 md:border-r">
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-wide text-ink/50">
            {stage.label} · {queue.length} · oldest first
          </p>
          <ul className="flex flex-col gap-2">
            {queue.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/w/${slug}/pipeline?stage=${stage.key}&article=${a.id}`}
                  className={
                    "block rounded-lg border p-2.5 " +
                    (a.id === selectedId ? "border-blue bg-paper shadow-[0_0_0_2px_rgba(13,90,132,.12)]" : "border-lightblue hover:border-blue")
                  }
                >
                  <span className="block text-[0.75rem] font-semibold leading-snug text-ink">{a.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {a.citations.length > 0 && (
                      <span className="rounded border border-orange/40 bg-orange/5 px-1 py-0.5 text-[0.55rem] text-orange">{a.citations.length} needs source</span>
                    )}
                    <span className="rounded border border-lightblue px-1 py-0.5 text-[0.55rem] text-blue">{a.state.replace(/_/g, " ")}</span>
                  </span>
                </Link>
              </li>
            ))}
            {queue.length === 0 && <li className="py-6 text-center text-xs text-ink/40">Nothing in this stage.</li>}
          </ul>
        </aside>

        {/* Document */}
        <section className="bg-paper p-5">
          {!selected ? (
            <p className="text-sm text-ink/50">Select an item from the queue.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="font-display text-xl font-bold text-ink">{selected.title}</h1>
                <Link href={`/w/${slug}/content/${selected.id}`} className="rounded-lg border border-lightblue bg-white px-3 py-1.5 text-xs font-semibold text-blue hover:border-blue">
                  Open full editor →
                </Link>
              </div>
              <p className="mb-4 text-xs text-ink/50">
                State: <strong className="text-blue">{selected.state}</strong>
                {selected.tier ? ` · Tier ${selected.tier}` : ""}{selected.audience ? ` · ${selected.audience}` : ""}
              </p>
              <article className="rounded-brand border border-lightblue bg-white p-5 text-sm leading-relaxed text-ink/80">
                {bodyPreview ? `${bodyPreview}${bodyPreview.length >= 600 ? "…" : ""}` : "No draft body yet — generate one in the editor."}
              </article>
            </>
          )}
        </section>

        {/* Gate inspector */}
        {selected && (
          <aside className="border-t border-lightblue bg-white p-4 xl:border-l xl:border-t-0">
            <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-wide text-ink/50">Gates</p>

            <div className="mb-3 space-y-1.5">
              <GateRow label="Sources" ok={unverified.length === 0} detail={unverified.length ? `${unverified.length} unverified` : "all verified"} />
              <GateRow label="WCAG" ok={a11y.every((c) => c.pass)} detail={`${a11y.filter((c) => c.pass).length}/${a11y.length}`} />
              <GateRow label="SEO" ok={!!selected.seoOutput} detail={selected.seoOutput ? "ready" : "not generated"} />
              <GateRow label="Assets" ok={hasFeatured && hasOg} detail={`${(hasFeatured ? 1 : 0) + (hasOg ? 1 : 0)}/2`} />
            </div>

            {!selected.seoOutput && (
              <form action={generateSeo} className="mb-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={selected.id} />
                <button className="w-full rounded-lg border border-lightblue px-3 py-1.5 text-xs font-semibold text-blue hover:border-blue">
                  Generate SEO fields
                </button>
              </form>
            )}

            <p className="mb-1.5 mt-3 text-[0.62rem] font-semibold uppercase tracking-wide text-ink/50">Advance</p>
            <div className="space-y-1.5">
              {targets.length === 0 && <p className="text-xs text-ink/40">No transitions from here.</p>}
              {targets.map((t) => (
                <form key={t} action={transitionArticle}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="target" value={t} />
                  <button
                    className={
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold " +
                      (t === "scheduled" || t === "published"
                        ? "bg-orange text-white"
                        : t === "drafting"
                          ? "border border-lightblue bg-white text-ink/70"
                          : "bg-blue text-white")
                    }
                  >
                    {TARGET_LABELS[t]}
                  </button>
                </form>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function GateRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-lightblue px-2.5 py-1.5 text-xs">
      <span className="flex items-center gap-2">
        <span className={ok ? "text-blue" : "text-orange"} aria-hidden>{ok ? "✓" : "○"}</span>
        <span className="font-semibold uppercase tracking-wide text-ink/60">{label}</span>
      </span>
      <span className={ok ? "text-ink/50" : "text-orange"}>{detail}</span>
    </div>
  );
}
