import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { identity } from "@/lib/identity";
import type { RoleName } from "@spark/shared";

export type WorkspaceMembership = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: RoleName;
};

export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentUser() {
  const id = await getSessionUserId();
  if (!id) return null;
  return identity.user.findUnique({ where: { id } });
}

/**
 * All non-archived workspaces the user belongs to, for the switcher. Reads the
 * signed-in user's OWN memberships via the control-plane client (see identity.ts).
 */
export async function getUserMemberships(
  userId: string,
): Promise<WorkspaceMembership[]> {
  const rows = await identity.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });
  return rows
    .filter((m) => m.workspace.status !== "archived")
    .map((m) => ({
      workspaceId: m.workspaceId,
      workspaceSlug: m.workspace.slug,
      workspaceName: m.workspace.name,
      role: m.role as RoleName,
    }));
}

/**
 * Require an authenticated user who is a member of `slug`. Redirects to /login
 * if signed out, or to the workspace chooser if not a member of that workspace.
 */
export async function requireMembership(
  slug: string,
): Promise<{ userId: string; membership: WorkspaceMembership }> {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?callbackUrl=/w/${slug}`);
  const memberships = await getUserMemberships(userId);
  const membership = memberships.find((m) => m.workspaceSlug === slug);
  if (!membership) redirect("/");
  return { userId, membership };
}
