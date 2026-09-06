"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/acl";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/governance";

/**
 * The manual half of the no-WordPress fallback: after an article's HTML was
 * downloaded and added to a site by hand, record it as published (with the
 * live URL) so the loop moves on — social variants, analytics and the board
 * all key off `published`. ADMIN only, like every other publish.
 */
export async function markPublishedManuallyAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const rawUrl = String(formData.get("url") ?? "").trim();
  const { workspace, user } = await requireRole("ADMIN");
  const post = await db.blogPost.findFirst({ where: { id, workspaceId: workspace.id }, select: { id: true, title: true, status: true } });
  if (!post) return;
  if (post.status !== "final_approval") {
    redirect(`/publish?err=${encodeURIComponent(`"${post.title.slice(0, 60)}" is at ${post.status}, not final approval — only articles that passed every check can be marked published.`)}`);
  }
  let publishedUrl: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol === "http:" || u.protocol === "https:") publishedUrl = u.toString();
    } catch { /* not a URL — recorded without one */ }
    if (!publishedUrl) redirect(`/publish?err=${encodeURIComponent("That live URL doesn't look like a web address — paste the full https:// link, or leave it empty.")}`);
  }
  await db.blogPost.update({ where: { id: post.id }, data: { status: "published", publishedAt: new Date(), publishedUrl } });
  await writeAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "blog.published_manually",
    entityType: "blog_post",
    entityId: post.id,
    meta: { publishedUrl, via: "html export" },
  });
  revalidatePath("/publish");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.id}`);
  revalidatePath("/inbox");
  redirect(`/publish?ok=${encodeURIComponent(`"${post.title.slice(0, 60)}" recorded as published${publishedUrl ? ` at ${publishedUrl}` : ""}.`)}`);
}
