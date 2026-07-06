import Link from "next/link";
import { Lock } from "lucide-react";
import { withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { recordSnapshot, toggleProtect } from "./actions";

type Snap = {
  capturedAt: Date;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  sessions: number | null;
  conversions: number | null;
};

function MonthlyClicksChart({ snaps }: { snaps: Snap[] }) {
  // Sum clicks by month across all snapshots.
  const byMonth = new Map<string, number>();
  for (const s of snaps) {
    if (s.clicks == null) continue;
    const d = new Date(s.capturedAt);
    const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    byMonth.set(key, (byMonth.get(key) ?? 0) + s.clicks);
  }
  const entries = [...byMonth.entries()].slice(-6);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        No click data yet — record snapshots below and the trend appears here.
      </p>
    );
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const W = 480;
  const H = 160;
  const pad = 28;
  const bw = (W - pad * 2) / entries.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={
        "Monthly clicks: " + entries.map(([m, v]) => `${m} ${v}`).join(", ")
      }
    >
      {entries.map(([month, v], i) => {
        const barH = ((H - pad * 2) * v) / max;
        const x = pad + i * bw + bw * 0.15;
        const y = H - pad - barH;
        return (
          <g key={month}>
            <rect x={x} y={y} width={bw * 0.7} height={barH} rx="4" fill="#0D5A84" />
            <text x={x + (bw * 0.7) / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#343433" fontFamily="Quicksand, sans-serif">{v}</text>
            <text x={x + (bw * 0.7) / 2} y={H - pad + 14} textAnchor="middle" fontSize="10" fill="#6B6F74" fontFamily="Quicksand, sans-serif">{month}</text>
          </g>
        );
      })}
    </svg>
  );
}

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

  const withLatest = data.articles.map((a) => ({ article: a, latest: a.analytics[0] }));
  const tracked = withLatest.filter((x) => x.latest);
  const allSnaps = data.articles.flatMap((a) => a.analytics);

  // Aggregate tiles (latest snapshot per article).
  const sum = (f: (s: Snap) => number | null) =>
    tracked.reduce((acc, x) => acc + (f(x.latest!) ?? 0), 0);
  const impressions = sum((s) => s.impressions);
  const clicks = sum((s) => s.clicks);
  const conversions = sum((s) => s.conversions);
  const positions = tracked.map((x) => x.latest!.position).filter((p): p is number => p != null);
  const avgPosition = positions.length
    ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
    : "—";

  // Feedback to ideas.
  const refreshCandidates = tracked
    .filter((x) => (x.latest!.position ?? 0) > 10)
    .sort((a, b) => (b.latest!.position ?? 0) - (a.latest!.position ?? 0))
    .slice(0, 5);
  const topPerformers = [...tracked]
    .sort((a, b) => (b.latest!.clicks ?? 0) - (a.latest!.clicks ?? 0))
    .slice(0, 5);

  const fmt = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

  const tiles = [
    { label: "Impressions", value: tracked.length ? fmt(impressions) : "—" },
    { label: "Clicks", value: tracked.length ? fmt(clicks) : "—" },
    { label: "Avg position", value: avgPosition },
    { label: "Conversions", value: tracked.length ? fmt(conversions) : "—" },
  ];

  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <span className="rounded-lg border border-lightblue bg-white px-3 py-1.5 text-xs text-blue">
          {data.gsc?.status === "connected" ? "GSC + GA4 connected" : "Manual entry · GSC/GA4 connector in V1"}
        </span>
      </header>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Post performance and the feedback loop into ideas (FR-14). Metrics are
        operator-entered or integration-sourced — never invented.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-brand border border-lightblue bg-white p-4">
            <p className="text-[0.65rem] uppercase tracking-wide text-ink/50">{t.label}</p>
            <p className="font-display text-3xl font-bold text-ink">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-brand border border-lightblue bg-white p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Clicks by month</h2>
          <MonthlyClicksChart snaps={allSnaps} />
        </section>

        <section className="rounded-brand border border-lightblue bg-white p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-ink">Feedback to ideas</h2>
          <div className="space-y-3 text-xs">
            <div>
              <p className="mb-1 font-semibold uppercase tracking-wide text-ink/50">Refresh candidates (position &gt; 10)</p>
              {refreshCandidates.length === 0 ? (
                <p className="text-ink/50">None — nothing ranking below the top 10.</p>
              ) : (
                <ul className="space-y-1">
                  {refreshCandidates.map((x) => (
                    <li key={x.article.id} className="flex items-center justify-between gap-2">
                      <Link href={`/w/${slug}/content/${x.article.id}`} className="truncate text-blue underline">
                        {x.article.title}
                      </Link>
                      <span className="shrink-0 text-orange">pos {x.latest!.position?.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-paper pt-2">
              <p className="mb-1 font-semibold uppercase tracking-wide text-ink/50">Top performers — protect from rewrites</p>
              {topPerformers.length === 0 ? (
                <p className="text-ink/50">No performance data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topPerformers.map((x) => (
                    <li key={x.article.id} className="flex items-center justify-between gap-2">
                      <Link href={`/w/${slug}/content/${x.article.id}`} className="truncate text-ink hover:text-blue">
                        {x.article.title}
                        <span className="ml-1 text-ink/40">{fmt(x.latest!.clicks ?? 0)} clicks</span>
                      </Link>
                      {canManage ? (
                        <form action={toggleProtect} className="shrink-0">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="articleId" value={x.article.id} />
                          <input type="hidden" name="protect" value={(!x.article.protectedFromRewrite).toString()} />
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
                          <Lock className="h-3 w-3 shrink-0 text-ink/50" aria-label="Protected from rewrites" />
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Per-article performance
        </h2>
        {withLatest.length === 0 ? (
          <p className="text-sm text-ink/60">
            No published articles yet. Performance appears after articles go live.
          </p>
        ) : (
          <div className="overflow-hidden rounded-brand border border-lightblue">
            <table className="w-full bg-white text-sm">
              <thead className="bg-ink text-left text-white">
                <tr>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Article</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Impr.</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Clicks</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Pos.</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Sess.</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">Conv.</th>
                  <th className="px-3 py-2 font-display text-xs font-semibold">As of</th>
                </tr>
              </thead>
              <tbody>
                {withLatest.map(({ article, latest }) => (
                  <tr key={article.id} className="border-t border-paper align-top">
                    <td className="px-3 py-2">
                      <Link href={`/w/${slug}/content/${article.id}`} className="font-medium text-ink hover:text-blue">
                        {article.title}
                      </Link>
                      {article.protectedFromRewrite && (
                        <Lock className="ml-1 inline h-3 w-3 align-[-0.1em] text-ink/50" aria-label="Protected from rewrites" />
                      )}
                      {canManage && (
                        <form action={recordSnapshot} className="mt-1.5 flex flex-wrap gap-1">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="articleId" value={article.id} />
                          {["impressions", "clicks", "position", "sessions", "conversions"].map((f) => (
                            <input
                              key={f}
                              name={f}
                              placeholder={f.slice(0, 4)}
                              inputMode="decimal"
                              className="w-14 rounded border border-lightblue px-1.5 py-0.5 text-[0.65rem] outline-none focus:border-blue"
                              aria-label={`${f} for ${article.title}`}
                            />
                          ))}
                          <button className="rounded bg-blue px-2 py-0.5 text-[0.65rem] font-semibold text-white">
                            Record
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-3 py-2">{latest?.impressions ?? "—"}</td>
                    <td className="px-3 py-2">{latest?.clicks ?? "—"}</td>
                    <td className="px-3 py-2">{latest?.position?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-2">{latest?.sessions ?? "—"}</td>
                    <td className="px-3 py-2">{latest?.conversions ?? "—"}</td>
                    <td className="px-3 py-2 text-ink/50">
                      {latest ? new Date(latest.capturedAt).toLocaleDateString() : "no data"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
