import { SparkLogo } from "@/components/SparkLogo";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { getUserMemberships, requireMembership } from "@/lib/auth-helpers";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  const { userId } = await requireMembership(params.workspace);
  const memberships = await getUserMemberships(userId);

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-nav">
        <div className="flex items-center gap-2 px-4 pb-2 pt-5">
          <SparkLogo size={28} />
          <span className="font-display text-base font-bold text-white">
            Spark
          </span>
        </div>
        <div className="px-3 pb-2">
          <WorkspaceSwitcher
            memberships={memberships}
            currentSlug={params.workspace}
          />
        </div>
        <Sidebar slug={params.workspace} />
      </aside>
      <main className="bg-paper">{children}</main>
    </div>
  );
}
