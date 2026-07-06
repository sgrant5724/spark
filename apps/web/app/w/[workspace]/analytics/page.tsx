import Link from "next/link";
import {
  ArrowUpNarrowWide,
  Eye,
  Lock,
  MousePointerClick,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { Widget, Sparkline } from "@/components/widgets";
import { Badge, Button, EmptyState, Gauge, StatCard } from "@/components/ui";
import {
  CsvExportButton,
  PerformanceScatter,
  TimeSeriesCharts,
  TopPagesBar,
  type MonthPoint,
  type ScatterPoint,
} from "./charts";
import { recordSnapshot, toggleProtect } from "./actions";

type Snap = {
  capturedAt: Date;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  sessions: number | null;
  conversions: number | null;
};

const fmt = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

const truncate = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export default async function AnalyticsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const canManage = can(membership.role, "strategy.manage");

  const data = await withWorkspace(db, workspaceId, async (tx) => {
    const articles = await tx.article.findMany({
      where: {
        workspaceId,
        state: { in: ["published", "distributed", "analyzing"] },
      },
      orderBy: { updatedAt: "desc" },
      include: { analytics: { orderBy: { capturedAt: "desc" } } },
    });
    const wp = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "gsc" } },
      select: { status: true },
    });
    return { articles, gsc: wp };
  });

  const withLatest = data.articles.map((a) => ({
    article: a,
    latest: a.analytics[0] as Snap | undefined,
    prev: a.analytics[1] as Snap | undefined,
  }));
  const tracked = withLatest.filter((x) => x.latest);
  const allSnaps: Snap[] = data.articles.flatMap((a) => a.analytics);
  const hasData = tracked.length > 0;

  // --- aggregate tiles (latest snapshot per article) + deltas vs previous ---
  const sumLatest = (f: (s: Snap) => number | null) =>
    tracked.reduce((acc, x) => acc + (f(x.latest!) ?? 0), 0);
  const withPrev = tracked.filter((x) => x.prev);
  const sumPrev = (f: (s: Snap) => number | null) =>
    withPrev.reduce((acc, x) => acc + (f(x.prev!) ?? 0), 0);

  const impressions = sumLatest((s) => s.impressions);
  const clicks = sumLatest((s) => s.clicks);
  const conversions = sumLatest((s) => s.conversions);
  const positions = tracked
    .map((x) => x.latest!.position)
    .filter((p): p is number => p != null);
  const avgPosition = positions.length
    ? positions.reduce((a, b) => a + b, 0) / positions.length
    : null;
  const ctr = impressions > 0 ? clicks / impressions : null;

  // delta helper: only when at least one article has a prior snapshot.
  const hasPrev = withPrev.length > 0;
  function delta(cur: number, prev: number, higherIsBetter = true) {
    if (!hasPrev || prev === 0) return undefined;
    const diff = cur - prev;
    if (diff === 0) return { text: "0%", dir: "flat" as const };
    const pct = Math.round((diff / prev) * 100);
    const good = higherIsBetter ? diff > 0 : diff < 0;
    return { text: `${Math.abs(pct)}%`, dir: good ? ("up" as const) : ("down" as const) };
  }

  // --- monthly time series (aggregate across all articles) ------------------
  const monthMap = new Map<
    string,
    { clicks: number; impressions: number; posSum: number; posN: number; sort: number }
  >();
  for (const s of allSnaps) {
    const d = new Date(s.capturedAt);
    const sort = d.getFullYear() * 12 + d.getMonth();
    const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const cur = monthMap.get(key) ?? { clicks: 0, impressions: 0, posSum: 0, posN: 0, sort };
    cur.clicks += s.clicks ?? 0;
    cur.impressions += s.impressions ?? 0;
    if (s.position != null) {
      cur.posSum += s.position;
      cur.posN += 1;
    }
    monthMap.set(key, cur);
  }
  const monthlySeries: MonthPoint[] = [...monthMap.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([month, v]) => ({
      month,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.posN ? +(v.posSum / v.posN).toFixed(1) : null,
    }));

  // --- top pages + opportunity scatter --------------------------------------
  const topPages = [...tracked]
    .filter((x) => (x.latest!.clicks ?? 0) > 0)
    .sort((a, b) => (b.latest!.clicks ?? 0) - (a.latest!.clicks ?? 0))
    .slice(0, 6)
    .map((x) => ({ name: truncate(x.article.title, 22), clicks: x.latest!.clicks ?? 0 }));

  const scatterPoints: ScatterPoint[] = tracked
    .filter((x) => x.latest!.position != null && x.latest!.clicks != null)
    .map((x) => ({
      title: truncate(x.article.title),
      position: x.latest!.position!,
      clicks: x.latest!.clicks!,
      protected: x.article.protectedFromRewrite,
    }));
  const clicksMid = scatterPoints.length
    ? scatterPoints.reduce((a, p) => a + p.clicks, 0) / scatterPoints.length
    : 0;

  // --- feedback to ideas -----------------------------------------------------
  const refreshCandidates = tracked
    .filter((x) => (x.latest!.position ?? 0) > 10)
    .sort((a, b) => (b.latest!.position ?? 0) - (a.latest!.position ?? 0))
    .slice(0, 5);
  const topPerformers = [...tracked]
    .sort((a, b) => (b.latest!.clicks ?? 0) - (a.latest!.clicks ?? 0))
    .slice(0, 5);

  // --- CSV export rows -------------------------------------------------------
  const csvHeaders = ["Article", "Impressions", "Clicks", "Position", "Sessions", "Conversions", "As of"];
  const csvRows: Array<Array<string | number>> = withLatest.map(({ article, latest }) => [
    article.title,
    latest?.impressions ?? "",
    latest?.clicks ?? "",
    latest?.position ?? "",
    latest?.sessions ?? "",
    latest?.conversions ?? "",
    latest ? new Date(latest.capturedAt).toISOString().slice(0, 10) : "",
  ]);

  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <div className="flex items-center gap-2">
          <CsvExportButton rows={csvRows} headers={csvHeaders} filename={`analytics-${slug}.csv`} />
          <Badge tone={data.gsc?.status === "connected" ? "blue" : "neutral"} dot>
            {data.gsc?.status === "connected"
              ? "GSC + GA4 connected"
              : "Manual entry · GSC/GA4 in V1"}
          </Badge>
        </div>
      </header>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Post performance and the feedback loop into ideas (FR-14). Metrics are
        operator-entered or integration-sourced — never invented.
      </p>

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Eye aria-hidden />}
          iconTone="blue"
          label="Impressions"
          value={hasData ? fmt(impressions) : "—"}
          delta={delta(impressions, sumPrev((s) => s.impressions))}
        />
        <StatCard
          icon={<MousePointerClick aria-hidden />}
          iconTone="orange"
          label="Clicks"
          value={hasData ? fmt(clicks) : "—"}
          delta={delta(clicks, sumPrev((s) => s.clicks))}
        />
        <StatCard
          icon={<ArrowUpNarrowWide aria-hidden />}
          iconTone="nav"
          label="Avg position"
          value={avgPosition != null ? avgPosition.toFixed(1) : "—"}
          delta={
            avgPosition != null && hasPrev
              ? delta(
                  avgPosition,
                  sumPrev((s) => s.position) / Math.max(withPrev.length, 1),
                  false,
                )
              : undefined
          }
        />
        <StatCard
          icon={<Target aria-hidden />}
          iconTone="cyan"
          label="Conversions"
          value={hasData ? fmt(conversions) : "—"}
          delta={delta(conversions, sumPrev((s) => s.conversions))}
        />
      </div>

      {/* Time series + CTR */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Widget className="p-5">
          {monthlySeries.length > 0 ? (
            <TimeSeriesCharts series={monthlySeries} />
          ) : (
            <EmptyState
              icon={<TrendingUp aria-hidden />}
              title="No trend data yet"
              description="Record performance snapshots below and the clicks, impressions, and position trends appear here. GSC/GA4 auto-populate them in V1."
            />
          )}
        </Widget>

        <Widget title="Click-through rate" className="flex flex-col p-5">
          {ctr != null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Gauge
                value={+(ctr * 100).toFixed(1)}
                max={10}
                label="vs 10% target"
                meaning="score"
                size={150}
                format={(_pct, v) => `${v}%`}
              />
              <p className="text-center text-xs text-ink/50">
                <span className="font-mono font-semibold text-ink">{fmt(clicks)}</span> clicks
                from <span className="font-mono font-semibold text-ink">{fmt(impressions)}</span>{" "}
                impressions
              </p>
            </div>
          ) : (
            <div className="flex flex-1 items-center">
              <EmptyState
                icon={<MousePointerClick aria-hidden />}
                title="No CTR yet"
                description="CTR appears once an article has both impressions and clicks recorded."
              />
            </div>
          )}
        </Widget>
      </div>

      {/* Top pages + opportunity map */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Widget title="Top pages by clicks" className="p-5">
          {topPages.length > 0 ? (
            <TopPagesBar pages={topPages} />
          ) : (
            <EmptyState title="No click data yet" description="Top pages rank once clicks are recorded." />
          )}
        </Widget>

        <Widget
          title="Opportunity map · position × clicks"
          className="p-5"
          action={
            <div className="flex gap-2 text-[0.58rem] text-ink/50">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-good" /> healthy
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-warn" /> refresh
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-status-info" /> protected
              </span>
            </div>
          }
        >
          {scatterPoints.length > 0 ? (
            <>
              <PerformanceScatter points={scatterPoints} clicksMid={clicksMid} />
              <p className="mt-1 text-[0.62rem] text-ink/50">
                Articles past position 10 (right of the dashed line) are refresh candidates;
                high-click, well-ranked posts are worth protecting from rewrites.
              </p>
            </>
          ) : (
            <EmptyState
              title="No position data yet"
              description="Record position + clicks to map refresh candidates against protected performers."
            />
          )}
        </Widget>
      </div>

      {/* Feedback to ideas */}
      <Widget title="Feedback to ideas" className="mb-6 p-5">
        <div className="grid grid-cols-1 gap-5 text-xs md:grid-cols-2">
          <div>
            <p className="mb-1.5 font-semibold uppercase tracking-wide text-ink/50">
              Refresh candidates (position &gt; 10)
            </p>
            {refreshCandidates.length === 0 ? (
              <p className="text-ink/50">None — nothing ranking below the top 10.</p>
            ) : (
              <ul className="space-y-1.5">
                {refreshCandidates.map((x) => (
                  <li key={x.article.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/w/${slug}/content/${x.article.id}`}
                      className="truncate text-blue underline"
                    >
                      {x.article.title}
                    </Link>
                    <Badge tone="warn">pos {x.latest!.position?.toFixed(1)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-paper pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <p className="mb-1.5 font-semibold uppercase tracking-wide text-ink/50">
              Top performers — protect from rewrites
            </p>
            {topPerformers.length === 0 ? (
              <p className="text-ink/50">No performance data yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {topPerformers.map((x) => (
                  <li key={x.article.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/w/${slug}/content/${x.article.id}`}
                      className="truncate text-ink hover:text-blue"
                    >
                      {x.article.title}
                      <span className="ml-1 font-mono text-ink/40">
                        {fmt(x.latest!.clicks ?? 0)} clicks
                      </span>
                    </Link>
                    {canManage ? (
                      <form action={toggleProtect} className="shrink-0">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="articleId" value={x.article.id} />
                        <input
                          type="hidden"
                          name="protect"
                          value={(!x.article.protectedFromRewrite).toString()}
                        />
                        <button
                          className={
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6rem] " +
                            (x.article.protectedFromRewrite
                              ? "border-yellow bg-yellow/20 text-ink"
                              : "border-lightblue text-blue")
                          }
                        >
                          {x.article.protectedFromRewrite && <Lock className="h-3 w-3" aria-hidden />}
                          {x.article.protectedFromRewrite ? "Protected" : "Protect"}
                        </button>
                      </form>
                    ) : (
                      x.article.protectedFromRewrite && (
                        <Lock
                          className="h-3 w-3 shrink-0 text-ink/50"
                          aria-label="Protected from rewrites"
                        />
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Widget>

      {/* Per-article table (accessible data fallback + manual entry) */}
      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">Per-article performance</h2>
        {withLatest.length === 0 ? (
          <p className="text-sm text-ink/60">
            No published articles yet. Performance appears after articles go live.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-brand border border-lightblue">
            <table className="w-full min-w-[720px] bg-white text-sm">
              <thead className="bg-ink text-left text-white">
                <tr>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Article</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Trend</th>
                  <th className="px-3 py-2 text-right font-display text-xs font-semibold">Impr.</th>
                  <th className="px-3 py-2 text-right font-display text-xs font-semibold">Clicks</th>
                  <th className="px-3 py-2 text-right font-display text-xs font-semibold">Pos.</th>
                  <th className="px-3 py-2 text-right font-display text-xs font-semibold">Sess.</th>
                  <th className="px-3 py-2 text-right font-display text-xs font-semibold">Conv.</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">As of</th>
                </tr>
              </thead>
              <tbody>
                {withLatest.map(({ article, latest, prev }) => {
                  const history = [...article.analytics]
                    .reverse()
                    .map((s) => s.clicks ?? 0);
                  const posTrend =
                    latest?.position != null && prev?.position != null
                      ? latest.position - prev.position
                      : null;
                  return (
                    <tr key={article.id} className="border-t border-paper align-top">
                      <td className="px-3 py-2">
                        <Link
                          href={`/w/${slug}/content/${article.id}`}
                          className="font-medium text-ink hover:text-blue"
                        >
                          {article.title}
                        </Link>
                        {article.protectedFromRewrite && (
                          <Lock
                            className="ml-1 inline h-3 w-3 align-[-0.1em] text-ink/50"
                            aria-label="Protected from rewrites"
                          />
                        )}
                        {canManage && (
                          <form action={recordSnapshot} className="mt-1.5 flex flex-wrap gap-1">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="articleId" value={article.id} />
                            {["impressions", "clicks", "position", "sessions", "conversions"].map(
                              (f) => (
                                <input
                                  key={f}
                                  name={f}
                                  placeholder={f.slice(0, 4)}
                                  inputMode="decimal"
                                  className="w-14 rounded border border-lightblue px-1.5 py-0.5 font-mono text-[0.65rem] outline-none focus:border-blue"
                                  aria-label={`${f} for ${article.title}`}
                                />
                              ),
                            )}
                            <Button type="submit" variant="secondary" size="sm">
                              Record
                            </Button>
                          </form>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {history.length > 1 ? (
                          <div className="w-24">
                            <Sparkline points={history} label={`${article.title} clicks history`} height={28} />
                          </div>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {latest?.impressions ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {latest?.clicks ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {latest?.position?.toFixed(1) ?? "—"}
                          {posTrend != null && posTrend !== 0 && (
                            posTrend < 0 ? (
                              <TrendingUp className="h-3 w-3 text-blue" aria-label="improved" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-orange" aria-label="declined" />
                            )
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {latest?.sessions ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {latest?.conversions ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink/50">
                        {latest ? new Date(latest.capturedAt).toLocaleDateString() : "no data"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
