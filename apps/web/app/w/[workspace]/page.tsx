import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getCurrentUser, requireMembership } from "@/lib/auth-helpers";

const REVIEW_STATES = [
  "draft_review",
  "seo_a11y_review",
  "assets_pending",
  "final_approval",
] as const;

export default async function DashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const user = await getCurrentUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const d = await withWorkspace(db, workspaceId, async (tx) => {
    const inWorkflow = await tx.article.count({
      where: { workspaceId, state: { in: ["drafting", ...REVIEW_STATES] } },
    });
    const awaitingApproval = await tx.article.count({
      where: { workspaceId, state: { in: ["final_approval", "scheduled"] } },
    });
    const published = await tx.article.count({
      where: { workspaceId, state: { in: ["published", "distributed", "analyzing"] } },
    });
    const ideasDiscovered = await tx.idea.count({
      where: { workspaceId, status: "discovered" },
    });
    const needsAttention = await tx.article.findMany({
      where: { workspaceId, state: { in: [...REVIEW_STATES] } },
      orderBy: { updatedAt: "asc" },
      take: 5,
      include: { citations: { where: { verified: false }, select: { id: true } } },
    });
    const org = await tx.orgProfile.findUnique({ where: { workspaceId } });
    const wp = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
      select: { status: true },
    });
    return { inWorkflow, awaitingApproval, published, ideasDiscovered, needsAttention, org, wp };
  });

  const llmConfigured = Boolean(process.env.ANTHROPIC_API_KEY ?? process.env.LLM_API_KEY);

  const setupSteps = [
    {
      done: Boolean(d.org?.description),
      label: "Fill in the Organization profile (grounds all AI output)",
      href: `/w/${slug}/organization`,
    },
    {
      done: llmConfigured,
      label: "Add ANTHROPIC_API_KEY in Railway (enables real AI generation)",
      href: null,
    },
    {
      done: d.wp?.status === "connected",
      label: "Connect the WordPress site (Settings → Integrations)",
      href: `/w/${slug}/settings`,
    },
  ].filter((s) => !s.done);

  const metrics = [
    { label: "In workflow", value: d.inWorkflow, href: `/w/${slug}/workflow` },
    { label: "Awaiting approval", value: d.awaitingApproval, href: `/w/${slug}/workflow` },
    { label: "Published", value: d.published, href: `/w/${slug}/content` },
    { label: "Ideas discovered", value: d.ideasDiscovered, href: `/w/${slug}/ideas` },
  ];

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">
          Good day, {firstName}
        </h1>
        <Link
          href={`/w/${slug}/ideas`}
          className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
        >
          + New content
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="rounded-brand border border-lightblue bg-white p-4 hover:border-blue"
          >
            <p className="text-[0.65rem] uppercase tracking-wide text-ink/50">{m.label}</p>
            <p className="font-display text-3xl font-bold text-ink">{m.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-brand border border-lightblue bg-white p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            Needs your attention
          </h2>
          {d.needsAttention.length === 0 ? (
            <p className="text-sm text-ink/50">
              Nothing waiting on review. Approve an idea to start a new draft.
            </p>
          ) : (
            <ul className="space-y-2">
              {d.needsAttention.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/w/${slug}/content/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper bg-paper/60 px-3 py-2 hover:border-blue"
                  >
                    <span className="text-sm font-medium text-ink">{a.title}</span>
                    <span className="flex gap-1.5 text-[0.6rem]">
                      {a.citations.length > 0 && (
                        <span className="rounded border border-orange/40 bg-white px-1.5 py-0.5 text-orange">
                          {a.citations.length} needs source
                        </span>
                      )}
                      <span className="rounded border border-lightblue bg-white px-1.5 py-0.5 text-blue">
                        {a.state.replace(/_/g, " ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-brand border border-lightblue bg-white p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            {setupSteps.length ? "Finish setting up" : "Workspace status"}
          </h2>
          {setupSteps.length === 0 ? (
            <p className="text-sm text-blue">
              ✓ Organization profile, AI provider, and WordPress are all configured.
            </p>
          ) : (
            <ul className="space-y-2">
              {setupSteps.map((s) => (
                <li key={s.label} className="flex items-start gap-2 text-sm">
                  <span className="text-orange" aria-hidden>○</span>
                  {s.href ? (
                    <Link href={s.href} className="text-blue underline">
                      {s.label}
                    </Link>
                  ) : (
                    <span className="text-ink/70">{s.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-paper pt-3 text-xs text-ink/50">
            Pipeline: Ideate → Personalize → Generate → Optimize → Assets →
            Review → Publish → Distribute → Analyze
          </div>
        </section>
      </div>
    </div>
  );
}
