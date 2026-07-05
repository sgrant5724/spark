import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { getSessionUserId, getUserMemberships } from "@/lib/auth-helpers";

// Tenant-scoped quick search for the ⌘K palette. Membership-checked; queries run
// inside withWorkspace so RLS keeps results within the workspace.
export async function GET(
  req: NextRequest,
  { params }: { params: { workspace: string } },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const memberships = await getUserMemberships(userId);
  const membership = memberships.find((m) => m.workspaceSlug === params.workspace);
  if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ articles: [], ideas: [] });

  const results = await withWorkspace(db, membership.workspaceId, async (tx) => {
    const articles = await tx.article.findMany({
      where: { workspaceId: membership.workspaceId, title: { contains: q, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, state: true },
    });
    const ideas = await tx.idea.findMany({
      where: { workspaceId: membership.workspaceId, title: { contains: q, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true },
    });
    return { articles, ideas };
  });

  return NextResponse.json(results);
}
