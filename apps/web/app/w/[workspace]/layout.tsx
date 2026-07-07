import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SparkLogo } from "@/components/SparkLogo";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchTrigger } from "@/components/SearchTrigger";
import { NotificationBell, type Note } from "@/components/NotificationBell";
import { ToastProvider } from "@/components/ui";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getUserMemberships, requireMembership } from "@/lib/auth-helpers";
import { can } from "@spark/shared";
import { signOut } from "@/auth";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  const { userId, membership } = await requireMembership(params.workspace);
  const memberships = await getUserMemberships(userId);

  const notes = await withWorkspace(db, membership.workspaceId, async (tx) => {
    const items = await tx.notification.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const unread = await tx.notification.count({
      where: { workspaceId: membership.workspaceId, readAt: null },
    });
    return { items, unread };
  });
  const noteItems: Note[] = notes.items.map((n) => ({
    id: n.id,
    type: n.type,
    payload: (n.payload as Record<string, unknown>) ?? null,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  }));

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <ToastProvider>
    {/* brand ribbon across the whole shell */}
    <div className="h-1 bg-gradient-to-r from-orange via-yellow to-blue-bright" aria-hidden />
    <div className="grid min-h-[calc(100vh-4px)] grid-rows-[auto_1fr] md:grid-cols-[240px_1fr] md:grid-rows-1">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-blue"
      >
        Skip to main content
      </a>

      <aside className="flex flex-col bg-gradient-to-b from-nav via-nav to-nav2 md:min-h-screen">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4 md:pt-5">
          <div className="flex items-center gap-2">
            <SparkLogo size={28} />
            <span className="font-display text-base font-bold text-white">
              Spark
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              slug={params.workspace}
              items={noteItems}
              unreadCount={notes.unread}
            />
            {/* Sign out lives in the header strip on mobile */}
            <form action={handleSignOut} className="md:hidden">
              <button className="rounded-lg border border-white/20 px-2.5 py-1 text-xs text-white/80">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-3 pb-1 md:pb-2">
          <Link
            href="/agency"
            className="flex items-center gap-1 px-1 text-[0.68rem] font-semibold uppercase tracking-wide text-cyan hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            All clients
          </Link>
          <WorkspaceSwitcher
            memberships={memberships}
            currentSlug={params.workspace}
          />
          <SearchTrigger />
        </div>
        <Sidebar
          slug={params.workspace}
          canAudit={can(membership.role, "workspace.manage")}
        />
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
    </ToastProvider>
  );
}
