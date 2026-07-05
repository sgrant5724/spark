import Link from "next/link";
import { SparkLogo } from "@/components/SparkLogo";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchTrigger } from "@/components/SearchTrigger";
import { getUserMemberships, requireMembership } from "@/lib/auth-helpers";
import { signOut } from "@/auth";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  const { userId } = await requireMembership(params.workspace);
  const memberships = await getUserMemberships(userId);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[240px_1fr] md:grid-rows-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-blue"
      >
        Skip to main content
      </a>

      <aside className="flex flex-col bg-nav md:min-h-screen">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 md:pt-5">
          <div className="flex items-center gap-2">
            <SparkLogo size={28} />
            <span className="font-display text-base font-bold text-white">
              Spark
            </span>
          </div>
          {/* Sign out lives in the header strip on mobile */}
          <form action={handleSignOut} className="md:hidden">
            <button className="rounded-lg border border-white/20 px-2.5 py-1 text-xs text-white/80">
              Sign out
            </button>
          </form>
        </div>
        <div className="flex flex-col gap-2 px-3 pb-1 md:pb-2">
          <Link
            href="/agency"
            className="flex items-center gap-1.5 px-1 text-[0.68rem] font-semibold uppercase tracking-wide text-cyan hover:text-white"
          >
            ◂ All clients
          </Link>
          <WorkspaceSwitcher
            memberships={memberships}
            currentSlug={params.workspace}
          />
          <SearchTrigger />
        </div>
        <Sidebar slug={params.workspace} />
        <form action={handleSignOut} className="mt-auto hidden px-3 pb-4 pt-2 md:block">
          <button className="w-full rounded-lg border border-white/20 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10">
            Sign out
          </button>
        </form>
      </aside>

      <main id="main-content" className="bg-paper">
        {children}
      </main>

      <CommandPalette slug={params.workspace} />
    </div>
  );
}
