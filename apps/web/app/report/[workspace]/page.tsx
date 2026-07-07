import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { SaveAsPdfButton } from "./SaveAsPdfButton";

// Lifecycle groupings (mirror the dashboard) — kept local to the report.
const REVIEW_STATES = ["draft_review", "seo_a11y_review", "assets_pending", "final_approval"];
const LIVE_STATES = ["published", "distributed", "analyzing"];
const IN_PIPELINE_STATES = ["drafting", ...REVIEW_STATES];
const REACHED_LIVE_STATES = ["scheduled", ...LIVE_STATES];

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

function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-GB");
}

/**
 * Client-facing monthly performance report, print-optimized (Save as PDF via
 * the browser). Standalone route — no workspace chrome — so the printed output
 * is clean. Every figure is real (operator-entered or pipeline-derived); empty
 * sections say so rather than inventing numbers.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { month?: string };
}) {
  const { membership } = await requireMembership(params.workspace);
  const workspaceId = membership.workspaceId;

  // Reporting period: the requested month (?month=YYYY-MM) or the current month.
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const m = /^(\d{4})-(\d{2})$/.exec(searchParams.month ?? "");
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]) - 1;
  }
  const periodStart = new Date(year, month, 1);
  const periodEnd = new Date(year, month + 1, 1);
  const periodLabel = periodStart.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const data = await withWorkspace(db, workspaceId, async (tx) => {
    const [articles, ideasApproved, latestSnap, periodSnaps, org] = await Promise.all([
      tx.article.findMany({
        where: { workspaceId },
        select: {
          id: true,
          title: true,
          state: true,
          tier: true,
          audience: true,
          updatedAt: true,
          publishedUrl: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      tx.idea.count({ where: { workspaceId, status: "approved" } }),
      tx.analyticsSnapshot.findMany({
        where: { workspaceId },
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { capturedAt: true, clicks: true, impressions: true, position: true },
      }),
      tx.analyticsSnapshot.findMany({
        where: { workspaceId, capturedAt: { gte: periodStart, lt: periodEnd } },
        select: { clicks: true, impressions: true },
      }),
      tx.orgProfile.findUnique({ where: { workspaceId }, select: { description: true } }),
    ]);
    return { articles, ideasApproved, latestSnap, periodSnaps, org };
  });

  const inState = (states: string[]) => data.articles.filter((a) => states.includes(a.state));
  const articlesLive = inState(LIVE_STATES).length;
  const inPipeline = inState(IN_PIPELINE_STATES).length;

  const publishedThisPeriod = data.articles
    .filter(
      (a) =>
        REACHED_LIVE_STATES.includes(a.state) &&
        a.updatedAt >= periodStart &&
        a.updatedAt < periodEnd,
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // Pipeline breakdown by stage (non-terminal + live groups shown).
  const stageOrder = [...IN_PIPELINE_STATES, ...REACHED_LIVE_STATES];
  const stageCounts = stageOrder
    .map((s) => ({ state: s, count: data.articles.filter((a) => a.state === s).length }))
    .filter((s) => s.count > 0);

  const latest = data.latestSnap[0] ?? null;
  const periodClicks = data.periodSnaps.reduce((a, s) => a + (s.clicks ?? 0), 0);
  const periodImpressions = data.periodSnaps.reduce((a, s) => a + (s.impressions ?? 0), 0);
  const hasPeriodMetrics = data.periodSnaps.length > 0;

  const generatedOn = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const kpis = [
    { label: "Articles live", value: fmtInt(articlesLive) },
    { label: "Published this period", value: fmtInt(publishedThisPeriod.length) },
    { label: "In pipeline", value: fmtInt(inPipeline) },
    { label: "Ideas approved", value: fmtInt(data.ideasApproved) },
  ];

  return (
    <div className="min-h-screen bg-paper2 print:bg-white">
      {/* Print page setup + hide app-less chrome when printing */}
      <style>{`@page { margin: 14mm; } @media print { .report-toolbar { display: none !important; } body { background: #fff; } }`}</style>

      {/* Toolbar (screen only) */}
      <div className="report-toolbar mx-auto flex max-w-3xl items-center justify-between px-6 py-4 print:hidden">
        <Link
          href={`/w/${params.workspace}/analytics`}
          className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to analytics
        </Link>
        <SaveAsPdfButton />
      </div>

      {/* The report sheet */}
      <article className="mx-auto max-w-3xl bg-white px-10 py-10 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* Header band */}
        <header className="mb-8 border-b border-lightblue pb-6">
          <div className="mb-4 h-1.5 w-24 rounded-full bg-gradient-to-r from-orange via-yellow to-blue-bright" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue">
            Monthly Performance Report
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">
            {membership.workspaceName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {periodLabel} · Prepared by LSI Media
          </p>
          {data.org?.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
              {data.org.description}
            </p>
          ) : null}
        </header>

        {/* KPI grid */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
            At a glance
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-brand border border-lightblue bg-paper2/40 p-4">
                <div className="font-mono text-2xl font-bold tabular-nums text-ink">{k.value}</div>
                <div className="mt-1 text-xs text-ink/60">{k.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Search performance */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
            Search performance
          </h2>
          {hasPeriodMetrics || latest ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label={`Clicks · ${periodLabel}`} value={hasPeriodMetrics ? fmtInt(periodClicks) : "—"} />
              <Metric label={`Impressions · ${periodLabel}`} value={hasPeriodMetrics ? fmtInt(periodImpressions) : "—"} />
              <Metric
                label="Avg position (latest)"
                value={latest?.position != null ? latest.position.toFixed(1) : "—"}
              />
            </div>
          ) : (
            <p className="rounded-brand border border-dashed border-lightblue bg-paper2/30 p-4 text-sm text-ink/60">
              No analytics recorded for this period. Metrics are operator-entered
              until GSC/GA4 connectors land — none were captured, so none are shown.
            </p>
          )}
        </section>

        {/* Published this period */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
            Content published · {periodLabel}
          </h2>
          {publishedThisPeriod.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-lightblue text-left text-xs uppercase tracking-wide text-ink/50">
                  <th className="py-2 font-semibold">Title</th>
                  <th className="py-2 font-semibold">Tier</th>
                  <th className="py-2 font-semibold">Audience</th>
                  <th className="py-2 text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {publishedThisPeriod.map((a) => (
                  <tr key={a.id} className="border-b border-paper">
                    <td className="py-2 pr-3 text-ink">{a.title}</td>
                    <td className="py-2 pr-3 text-ink/60">{a.tier ? `T${a.tier}` : "—"}</td>
                    <td className="py-2 pr-3 text-ink/60">{a.audience ?? "—"}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-ink/60">
                      {a.updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rounded-brand border border-dashed border-lightblue bg-paper2/30 p-4 text-sm text-ink/60">
              No articles reached publish/scheduled in this period.
            </p>
          )}
        </section>

        {/* Pipeline status */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
            Pipeline status (current)
          </h2>
          {stageCounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {stageCounts.map((s) => (
                <div
                  key={s.state}
                  className="rounded-lg border border-lightblue bg-paper2/40 px-3 py-2 text-sm"
                >
                  <span className="text-ink/70">{STATE_LABELS[s.state] ?? s.state}</span>{" "}
                  <span className="font-mono font-semibold tabular-nums text-ink">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-brand border border-dashed border-lightblue bg-paper2/30 p-4 text-sm text-ink/60">
              No articles in the pipeline right now.
            </p>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-lightblue pt-4 text-xs text-ink/50">
          Generated {generatedOn} · Prepared by LSI Media · Figures are
          operator-entered or pipeline-derived — never invented.
        </footer>
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand border border-lightblue bg-paper2/40 p-4">
      <div className="font-mono text-xl font-bold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink/60">{label}</div>
    </div>
  );
}
