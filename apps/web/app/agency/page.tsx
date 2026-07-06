import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Inbox, Rocket, TriangleAlert, Users } from "lucide-react";
import { ArticleState, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getSessionUserId, getUserMemberships } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import { SparkLogo } from "@/components/SparkLogo";
import { Badge, Gauge, StatCard } from "@/components/ui";

const LIVE: ArticleState[] = ["published", "distributed", "analyzing"];
const REVIEW: ArticleState[] = ["draft_review", "seo_a11y_review", "assets_pending", "final_approval"];

const idleDays = (d: Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

// Composite client health (0-100) from real signals: onboarding completeness
// (40), publishing cadence this month (30), and approval freshness (30).
function healthScore(orgPct: number, publishedMonth: number, idle: number): number {
  const onboarding = (orgPct / 100) * 40;
  const cadence = publishedMonth > 0 ? 30 : 0;
  const freshness = idle === 0 ? 30 : idle < 3 ? 21 : idle < 7 ? 10 : 0;
  return Math.round(onboarding + cadence + freshness);
}

export default async function AgencyConsole() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?callbackUrl=/agency");
  const memberships = await getUserMemberships(userId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Fan out one RLS-scoped call per workspace the user belongs to. Never a
  // cross-tenant query — each runs inside its own withWorkspace scope.
  const clients = await Promise.all(
    memberships.map(async (m) => {
      const data = await withWorkspace(db, m.workspaceId, async (tx) => {
        const byState = await tx.article.groupBy({
          by: ["state"],
          where: { workspaceId: m.workspaceId },
          _count: { _all: true },
        });
        const oldestApproval = await tx.article.findFirst({
          where: { workspaceId: m.workspaceId, state: "final_approval" },
          orderBy: { updatedAt: "asc" },
          select: { updatedAt: true },
        });
        const publishedMonth = await tx.article.count({
          where: { workspaceId: m.workspaceId, state: { in: LIVE }, updatedAt: { gte: monthStart } },
        });
        const org = await tx.orgProfile.findUnique({
          where: { workspaceId: m.workspaceId },
          select: { description: true, industry: true, services: true },
        });
        const pending = await tx.article.findMany({
          where: { workspaceId: m.workspaceId, state: { in: REVIEW } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, title: true, state: true, updatedAt: true },
        });
        return { byState, oldestApproval, publishedMonth, org, pending };
      });

      const count = (states: string[]) =>
        data.byState.filter((b) => states.includes(b.state)).reduce((a, b) => a + b._count._all, 0);
      const activePipeline = count(["drafting", ...REVIEW]);
      const approvalsWaiting = count(["final_approval"]);
      const publishedMonth = data.publishedMonth;
      // Stage breakdown for the content-volume bar.
      const stages = {
        drafting: count(["drafting"]),
        review: count(["draft_review", "seo_a11y_review", "assets_pending"]),
        approval: count(["final_approval", "scheduled"]),
        live: count(LIVE),
      };
      const orgFields = [data.org?.description, data.org?.industry, (data.org?.services as unknown[] | undefined)?.length ? "y" : ""].filter(Boolean).length;
      const orgPct = Math.round((orgFields / 3) * 100);
      const idle = data.oldestApproval ? idleDays(data.oldestApproval.updatedAt) : 0;
      const health = healthScore(orgPct, publishedMonth, idle);

      const status: { label: string; tone: "neutral" | "blue" | "warn" | "critical" } =
        orgPct < 100
          ? { label: "onboarding", tone: "warn" }
          : idle >= 7
            ? { label: `${idle}d idle`, tone: "critical" }
            : idle >= 3
              ? { label: `${idle}d idle`, tone: "warn" }
              : { label: "healthy", tone: "blue" };

      return { ...m, activePipeline, approvalsWaiting, publishedMonth, stages, orgPct, idle, health, status, pending: data.pending };
    }),
  );

  const totalApprovals = clients.reduce((a, c) => a + c.approvalsWaiting, 0);
  const totalPublished = clients.reduce((a, c) => a + c.publishedMonth, 0);
  const onCadence = clients.filter((c) => c.publishedMonth > 0).length;

  // Cross-workspace approvals inbox.
  const inbox = clients
    .flatMap((c) => c.pending.map((p) => ({ ...p, slug: c.workspaceSlug, client: c.workspaceName })))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 10);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center gap-3 bg-nav px-6 py-3 text-white">
        <SparkLogo size={26} />
        <span className="font-display text-base font-bold">Spark · Agency Console</span>
        <span className="ml-3 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-cyan">
          {clients.length} workspace{clients.length === 1 ? "" : "s"}
        </span>
        <form action={handleSignOut} className="ml-auto">
          <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10">Sign out</button>
        </form>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="mb-1 font-display text-2xl font-bold text-ink">All clients</h1>
        <p className="mb-6 max-w-2xl text-sm text-ink/60">
          Every workspace you manage, in one place. Approvals from all clients flow into a single inbox —
          each action still runs inside its own workspace, isolated.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Inbox aria-hidden />}
            iconTone={totalApprovals ? "orange" : "blue"}
            label="Approvals waiting"
            value={totalApprovals}
            delta={totalApprovals ? { text: "action needed", dir: "down" } : undefined}
          />
          <StatCard icon={<Rocket aria-hidden />} iconTone="blue" label="Published (mo)" value={totalPublished} />
          <StatCard
            icon={<Activity aria-hidden />}
            iconTone="nav"
            label="Active this month"
            value={`${onCadence}/${clients.length}`}
            delta={onCadence < clients.length ? { text: "some behind", dir: "flat" } : { text: "on cadence", dir: "up" }}
          />
          <StatCard icon={<Users aria-hidden />} iconTone="cyan" label="Workspaces" value={clients.length} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Client health cards */}
          <section>
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">Clients</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clients.map((c) => (
                <Link
                  key={c.workspaceId}
                  href={`/w/${c.workspaceSlug}`}
                  className="rounded-brand border border-lightblue bg-white p-4 shadow-sm transition-colors hover:border-blue"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-orange to-cyan" aria-hidden />
                    <span className="truncate font-display text-sm font-semibold text-ink">{c.workspaceName}</span>
                    <span className="ml-auto shrink-0">
                      <Badge tone={c.status.tone} dot>{c.status.label}</Badge>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Gauge
                      value={c.health}
                      max={100}
                      label="health"
                      meaning="score"
                      size={72}
                      format={(pct) => `${Math.round(pct * 100)}`}
                    />
                    <dl className="flex-1 space-y-1 text-[0.7rem] text-ink/60">
                      <div className="flex justify-between gap-2"><dt>Active pipeline</dt><dd className="font-mono font-semibold tabular-nums text-ink">{c.activePipeline}</dd></div>
                      <div className="flex justify-between gap-2"><dt>Approvals waiting</dt><dd className="font-mono font-semibold tabular-nums text-ink">{c.approvalsWaiting}</dd></div>
                      <div className="flex justify-between gap-2"><dt>Published (mo)</dt><dd className="font-mono font-semibold tabular-nums text-ink">{c.publishedMonth}</dd></div>
                    </dl>
                  </div>
                  {/* Content volume by stage */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[0.55rem] uppercase tracking-wide text-ink/40">
                      <span>Content volume</span>
                      <span className="font-mono tabular-nums">
                        {c.stages.drafting + c.stages.review + c.stages.approval + c.stages.live} total
                      </span>
                    </div>
                    <VolumeBar stages={c.stages} />
                  </div>
                  <div className="mt-2.5">
                    <div className="mb-1 flex justify-between text-[0.55rem] uppercase tracking-wide text-ink/40">
                      <span>Onboarding</span><span className="font-mono tabular-nums">{c.orgPct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-paper2">
                      <div className="h-full rounded" style={{ width: `${c.orgPct}%`, background: c.orgPct === 100 ? "#0D5A84" : "linear-gradient(90deg,#F8CF40,#C4571C)" }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Cross-workspace approvals inbox */}
          <section>
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">Approvals inbox · all clients</h2>
            <div className="rounded-brand border border-lightblue bg-white p-3">
              {inbox.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink/40">Nothing waiting across your clients — inbox clear.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inbox.map((it) => (
                    <li key={it.id}>
                      <Link
                        href={`/w/${it.slug}/content/${it.id}`}
                        className="block rounded-lg border border-paper bg-paper/50 px-3 py-2 hover:border-blue"
                      >
                        <span className="block truncate text-[0.78rem] font-medium text-ink">{it.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] text-ink/50">
                          <span className="font-semibold text-blue">{it.client}</span>
                          · {it.state.replace(/_/g, " ")}
                          · {idleDays(it.updatedAt)}d
                          {idleDays(it.updatedAt) >= 4 && (
                            <TriangleAlert className="h-3 w-3 text-orange" aria-label="Idle 4+ days" />
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Horizontal stacked bar of a client's content by pipeline stage. */
function VolumeBar({
  stages,
}: {
  stages: { drafting: number; review: number; approval: number; live: number };
}) {
  const segments = [
    { key: "drafting", label: "Drafting", n: stages.drafting, color: "#B1D4E0" },
    { key: "review", label: "In review", n: stages.review, color: "#6FA8C4" },
    { key: "approval", label: "Approval", n: stages.approval, color: "#F8CF40" },
    { key: "live", label: "Live", n: stages.live, color: "#0D5A84" },
  ];
  const total = segments.reduce((a, s) => a + s.n, 0);
  if (total === 0) {
    return <div className="h-2 rounded-full bg-paper2" aria-label="No content yet" />;
  }
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-paper2"
      role="img"
      aria-label={"Content by stage: " + segments.filter((s) => s.n).map((s) => `${s.label} ${s.n}`).join(", ")}
    >
      {segments.map((s) =>
        s.n ? (
          <span
            key={s.key}
            title={`${s.label}: ${s.n}`}
            style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
          />
        ) : null,
      )}
    </div>
  );
}
