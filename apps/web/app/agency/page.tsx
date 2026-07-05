import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleState, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getSessionUserId, getUserMemberships } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import { SparkLogo } from "@/components/SparkLogo";
import { Kpi } from "@/components/widgets";

const LIVE: ArticleState[] = ["published", "distributed", "analyzing"];
const REVIEW: ArticleState[] = ["draft_review", "seo_a11y_review", "assets_pending", "final_approval"];

const idleDays = (d: Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

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
      const orgFields = [data.org?.description, data.org?.industry, (data.org?.services as unknown[] | undefined)?.length ? "y" : ""].filter(Boolean).length;
      const orgPct = Math.round((orgFields / 3) * 100);
      const idle = data.oldestApproval ? idleDays(data.oldestApproval.updatedAt) : 0;

      const status: { label: string; tone: "ok" | "warn" | "onboard" } =
        orgPct < 100
          ? { label: "onboarding", tone: "onboard" }
          : idle >= 3
            ? { label: `${idle}d idle`, tone: "warn" }
            : { label: "healthy", tone: "ok" };

      return { ...m, activePipeline, approvalsWaiting, publishedMonth, orgPct, idle, status, pending: data.pending };
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
          <Kpi label="Approvals waiting" value={totalApprovals} delta={totalApprovals ? "action needed" : "clear"} tone={totalApprovals ? "warn" : "flat"} />
          <Kpi label="Published (mo)" value={totalPublished} delta="all clients" tone="up" />
          <Kpi label="Active this month" value={`${onCadence}/${clients.length}`} delta={onCadence < clients.length ? "some behind" : "on cadence"} tone={onCadence < clients.length ? "warn" : "up"} />
          <Kpi label="Workspaces" value={clients.length} delta="you're a member" tone="flat" />
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
                  className="rounded-brand border border-lightblue bg-white p-4 transition-colors hover:border-blue"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-orange to-cyan" aria-hidden />
                    <span className="truncate font-display text-sm font-semibold text-ink">{c.workspaceName}</span>
                    <span
                      className={
                        "ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] " +
                        (c.status.tone === "ok"
                          ? "border-lightblue bg-paper text-blue"
                          : c.status.tone === "onboard"
                            ? "border-yellow bg-yellow/20 text-ink"
                            : "border-orange/40 bg-orange/5 text-orange")
                      }
                    >
                      {c.status.label}
                    </span>
                  </div>
                  <dl className="space-y-1 text-[0.7rem] text-ink/60">
                    <div className="flex justify-between"><dt>Active pipeline</dt><dd className="font-semibold tabular-nums text-ink">{c.activePipeline}</dd></div>
                    <div className="flex justify-between"><dt>Approvals waiting</dt><dd className="font-semibold tabular-nums text-ink">{c.approvalsWaiting}</dd></div>
                    <div className="flex justify-between"><dt>Published this month</dt><dd className="font-semibold tabular-nums text-ink">{c.publishedMonth}</dd></div>
                  </dl>
                  <div className="mt-2.5">
                    <div className="mb-1 flex justify-between text-[0.58rem] uppercase tracking-wide text-ink/40">
                      <span>Onboarding</span><span className="tabular-nums">{c.orgPct}%</span>
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
                <p className="py-4 text-center text-xs text-ink/40">Nothing waiting across your clients. 🎉</p>
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
                          {idleDays(it.updatedAt) >= 4 && <span className="text-orange">⚠</span>}
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
