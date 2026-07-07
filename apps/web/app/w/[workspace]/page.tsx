import Link from "next/link";
import {
  Circle,
  FileText,
  GitBranch,
  Lightbulb,
  MousePointerClick,
  Pause,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getCurrentUser, requireMembership } from "@/lib/auth-helpers";
import {
  Widget,
  Sparkline,
  MiniCalendar,
  ActivityFeed,
  QueueList,
} from "@/components/widgets";
import { Badge, Funnel, Gauge, StatCard } from "@/components/ui";

const REVIEW_STATES = ["draft_review", "seo_a11y_review", "assets_pending", "final_approval"] as const;
const LIVE_STATES = ["published", "distributed", "analyzing"] as const;

function activityText(action: string, meta: Record<string, unknown>): { text: string; hot?: boolean } {
  switch (action) {
    case "article.generated":
      return { text: `Draft generated${meta.needsSource ? ` · ${meta.needsSource} claim(s) to source` : ""}` };
    case "idea.ai_discovery":
      return { text: `AI proposed ${meta.created ?? "several"} topic ideas` };
    case "pipeline.run":
      return { text: `Pipeline run · ${meta.processed ?? 0} auto-drafted`, hot: true };
    case "article.published_wordpress":
      return { text: "Published to WordPress", hot: true };
    case "user.invited":
      return { text: `Invited ${meta.email ?? "a teammate"}` };
    case "citation.verified":
      return { text: "A source was verified" };
    default:
      return { text: action.replace(/[._]/g, " ") };
  }
}

const rel = (d: Date) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

export default async function MissionControl({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const user = await getCurrentUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const now = new Date();

  const d = await withWorkspace(db, workspaceId, async (tx) => {
    const byState = await tx.article.groupBy({
      by: ["state"],
      where: { workspaceId },
      _count: { _all: true },
    });
    const ideasReady = await tx.idea.count({ where: { workspaceId, status: "discovered" } });
    const ideasApproved = await tx.idea.count({ where: { workspaceId, status: "approved" } });
    const needsYou = await tx.article.findMany({
      where: { workspaceId, state: { in: [...REVIEW_STATES] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
      include: { citations: { where: { verified: false }, select: { id: true } } },
    });
    const cadence = await tx.article.findMany({
      where: {
        workspaceId,
        state: { in: ["scheduled", ...LIVE_STATES] },
        updatedAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      select: { state: true, updatedAt: true },
    });
    const snaps = await tx.analyticsSnapshot.findMany({
      where: { workspaceId },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, clicks: true },
    });
    const activity = await tx.auditLog.findMany({
      where: {
        workspaceId,
        action: {
          in: [
            "article.generated",
            "idea.ai_discovery",
            "pipeline.run",
            "article.published_wordpress",
            "citation.verified",
            "user.invited",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const automation = await tx.automationSetting.findMany({ where: { workspaceId } });
    const org = await tx.orgProfile.findUnique({ where: { workspaceId }, select: { description: true } });
    const wp = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
      select: { status: true },
    });
    return { byState, ideasReady, ideasApproved, needsYou, cadence, snaps, activity, automation, org, wp };
  });

  const count = (states: readonly string[]) =>
    d.byState.filter((b) => states.includes(b.state)).reduce((a, b) => a + b._count._all, 0);
  const inPipeline = count(["drafting", ...REVIEW_STATES]);
  const published = count(LIVE_STATES);

  // Clicks by month → sparkline (last 6).
  const byMonth = new Map<string, number>();
  for (const s of d.snaps) {
    if (s.clicks == null) continue;
    const k = `${new Date(s.capturedAt).getFullYear()}-${new Date(s.capturedAt).getMonth()}`;
    byMonth.set(k, (byMonth.get(k) ?? 0) + s.clicks);
  }
  const clicksSeries = [...byMonth.values()].slice(-6);
  const clicks28 = clicksSeries.length ? clicksSeries[clicksSeries.length - 1] : 0;

  // Cadence calendar marks.
  const marks: Record<number, "published" | "scheduled"> = {};
  for (const a of d.cadence) {
    const day = new Date(a.updatedAt).getDate();
    marks[day] = a.state === "scheduled" ? "scheduled" : "published";
  }

  const automation = d.automation;
  const globalPause = automation.some((a) => a.globalPause);
  const autoPublish = automation.some((a) => a.autoPublish);
  const spendCap = automation.reduce<number | null>((m, a) => {
    const v = a.spendCap ? Number(a.spendCap) : null;
    return v != null && (m == null || v > m) ? v : m;
  }, null);

  const setup: Array<{ label: string; href?: string }> = [];
  if (!d.org?.description) setup.push({ label: "Fill in the Organization profile", href: `/w/${slug}/organization` });
  if (d.wp?.status !== "connected") setup.push({ label: "Connect WordPress", href: `/w/${slug}/settings` });

  // Onboarding completeness — composed from real signals only (no invented %).
  const ideasTotal = d.ideasReady + d.ideasApproved;
  const onboardingChecks = [
    !!d.org?.description,
    d.wp?.status === "connected",
    ideasTotal > 0,
    published > 0,
  ];
  const onboardingDone = onboardingChecks.filter(Boolean).length;

  return (
    <div className="px-6 py-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-accent">Mission Control · {membership.workspaceName}</p>
          <h1 className="font-display text-2xl font-bold text-ink">Good day, {firstName}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/w/${slug}/ideas`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 font-display text-sm font-semibold text-accent hover:border-accent">
            <Sparkles className="h-4 w-4" aria-hidden /> Discover ideas
          </Link>
          <Link href={`/w/${slug}/ideas`} className="inline-flex items-center gap-1.5 rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white">
            <Zap className="h-4 w-4" aria-hidden /> Run pipeline
          </Link>
        </div>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* KPI row */}
        <StatCard
          icon={<GitBranch aria-hidden />}
          iconTone="blue"
          label="In pipeline"
          value={inPipeline}
          delta={count(REVIEW_STATES) ? { text: `${count(REVIEW_STATES)} in review`, dir: "flat" } : undefined}
          href={`/w/${slug}/workflow`}
        />
        <StatCard
          icon={<Rocket aria-hidden />}
          iconTone="orange"
          label="Published"
          value={published}
          href={`/w/${slug}/content`}
        />
        <StatCard
          icon={<MousePointerClick aria-hidden />}
          iconTone="nav"
          label="Clicks (latest)"
          value={clicks28 ? fmt(clicks28) : "—"}
          spark={clicksSeries.length > 1 ? { points: clicksSeries, label: "Monthly clicks" } : undefined}
          href={`/w/${slug}/analytics`}
        />
        <StatCard
          icon={<Lightbulb aria-hidden />}
          iconTone="cyan"
          label="Ideas ready"
          value={d.ideasReady}
          delta={d.ideasApproved ? { text: `${d.ideasApproved} approved`, dir: "up" } : undefined}
          href={`/w/${slug}/ideas`}
        />

        {/* Pipeline funnel (2 wide) */}
        <Widget title="Pipeline funnel" className="col-span-2" action={<Link href={`/w/${slug}/workflow`} className="text-[0.62rem] font-semibold text-accent hover:underline">Open board →</Link>}>
          <Funnel
            stages={[
              { label: "Ideas", count: ideasTotal },
              { label: "Drafting", count: count(["drafting"]) },
              { label: "In review", count: count(["draft_review", "seo_a11y_review", "assets_pending"]) },
              { label: "Approval", count: count(["final_approval", "scheduled"]) },
              { label: "Live", count: published },
            ]}
          />
        </Widget>

        {/* Needs you (2 tall) */}
        <Widget title="Needs you" className="col-span-2 row-span-2" action={d.needsYou.length ? <span className="rounded border border-accent-warn/40 bg-orange/5 px-1.5 py-0.5 text-[0.6rem] text-accent-warn">{d.needsYou.length}</span> : undefined}>
          <QueueList
            empty="Nothing waiting on review. Approve an idea to start a draft."
            items={d.needsYou.map((a) => ({
              href: `/w/${slug}/content/${a.id}`,
              title: a.title,
              chips: [
                ...(a.citations.length ? [{ text: `${a.citations.length} needs source`, tone: "warn" as const }] : []),
                { text: a.state.replace(/_/g, " "), tone: "ok" as const },
              ],
            }))}
          />
        </Widget>

        {/* Cadence calendar */}
        <Widget title={`Cadence · ${now.toLocaleDateString("en-US", { month: "short" })}`}>
          <MiniCalendar year={now.getFullYear()} month={now.getMonth()} marks={marks} />
          <div className="mt-2 flex gap-3 text-[0.55rem] text-ink/50">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-blue" /> published</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded bg-yellow" /> scheduled</span>
          </div>
        </Widget>

        {/* Guardrails */}
        <Widget
          title="Guardrails"
          action={<Link href={`/w/${slug}/settings`} className="text-[0.62rem] font-semibold text-accent hover:underline">Manage →</Link>}
        >
          <ul className="flex flex-col gap-2 text-[0.72rem]">
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-ink/60">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden /> Publish gate
              </span>
              <Badge tone={autoPublish ? "warn" : "blue"}>
                {autoPublish ? "auto per type" : "human required"}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-ink/60">
                <Zap className="h-3.5 w-3.5 text-accent-warn" aria-hidden /> AI spend cap
              </span>
              <span className="font-mono font-semibold tabular-nums text-ink">
                {spendCap != null ? `$${spendCap}/mo` : "—"}
              </span>
            </li>
            <li
              className={
                "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 " +
                (globalPause ? "bg-status-critical/5" : "bg-paper2/60")
              }
            >
              <span className="flex items-center gap-1.5 text-ink/60">
                <Pause className={"h-3.5 w-3.5 " + (globalPause ? "text-accent-danger" : "text-ink/40")} aria-hidden />
                Global pause
              </span>
              {globalPause ? (
                <Badge tone="critical" dot>PAUSED</Badge>
              ) : (
                <span className="font-semibold text-ink/50">off</span>
              )}
            </li>
          </ul>
        </Widget>

        {/* Clicks trend (2 wide) */}
        <Widget title="Organic clicks · by month" className="col-span-2" action={<span className="rounded border border-line px-1.5 py-0.5 text-[0.6rem] text-accent">{d.wp?.status === "connected" ? "GSC (V1)" : "manual"}</span>}>
          {clicksSeries.length > 1 ? (
            <Sparkline points={clicksSeries} label={`Monthly clicks, latest ${fmt(clicks28)}`} height={56} />
          ) : (
            <p className="py-4 text-xs text-ink/40">Record analytics snapshots to see the trend. GSC/GA4 auto-populate this in V1.</p>
          )}
        </Widget>

        {/* AI activity */}
        <Widget title="AI activity" className="col-span-2">
          <ActivityFeed
            items={d.activity.map((a) => {
              const t = activityText(a.action, (a.metadata as Record<string, unknown>) ?? {});
              return { text: t.text, hot: t.hot, when: rel(a.createdAt) };
            })}
          />
        </Widget>

        {/* Finish setup (only if incomplete) */}
        {setup.length > 0 && (
          <Widget title="Finish setting up" className="col-span-2">
            <div className="flex items-center gap-4">
              <Gauge
                value={onboardingDone}
                max={onboardingChecks.length}
                label="setup"
                meaning="score"
                size={96}
                format={(pct) => `${Math.round(pct * 100)}%`}
              />
              <ul className="flex flex-1 flex-col gap-1.5 text-sm">
              {setup.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-warn" aria-hidden />
                  {s.href ? <Link href={s.href} className="text-accent underline">{s.label}</Link> : <span className="text-ink/70">{s.label}</span>}
                </li>
              ))}
              {!process.env.ANTHROPIC_API_KEY && !process.env.LLM_API_KEY && (
                <li className="flex items-start gap-2"><Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-warn" aria-hidden /><span className="text-ink/70">Add ANTHROPIC_API_KEY for real AI generation</span></li>
              )}
              </ul>
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
