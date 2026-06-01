import { getCurrentUser, requireMembership } from "@/lib/auth-helpers";

export default async function DashboardPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { membership } = await requireMembership(params.workspace);
  const user = await getCurrentUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">
          Good day, {firstName}
        </h1>
        <span className="rounded-lg border border-lightblue bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-blue">
          {membership.role}
        </span>
      </header>

      <p className="max-w-xl text-ink/70">
        Workspace <strong>{membership.workspaceName}</strong> is connected. The
        dashboard metrics, idea board, content workspace, and approval flow are
        built in subsequent epics — this confirms auth, tenancy, and the
        workspace switcher are wired up end-to-end.
      </p>
    </div>
  );
}
