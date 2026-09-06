import Link from "next/link";
import { requireMembership } from "@/lib/acl";
import { getActiveChannel } from "@/lib/channel";
import { db } from "@/lib/db";
import { AskDrawer, StageHeader, StageList, StageRow, StateChip } from "@/components/StageShell";

// Drafts stage: everything being written or rendered, by format — articles,
// scripts, video renders. The studio pages (scripts, thumbnails, production)
// are tabs here; step 6 gates them behind a connected YouTube channel.

const BLOG_HUE: Record<string, string> = { drafting: "amber", draft_review: "blue" };

export default async function DraftsStage() {
  const { workspace } = await requireMembership();
  const { active } = await getActiveChannel();
  const [posts, scripts, renders, counts] = await Promise.all([
    db.blogPost.findMany({
      where: { workspaceId: workspace.id, status: { in: ["drafting", "draft_review"] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true, status: true, updatedAt: true, body: true },
    }),
    db.script.findMany({
      where: { channel: { workspaceId: workspace.id }, status: "draft" },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, workflow: true, wordCount: true, updatedAt: true, channel: { select: { name: true } } },
    }),
    db.videoRender.findMany({
      where: { workspaceId: workspace.id, status: { in: ["queued", "rendering"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, status: true, createdAt: true },
    }),
    db.blogPost.groupBy({ by: ["status"], where: { workspaceId: workspace.id, status: { in: ["drafting", "draft_review"] } }, _count: { _all: true } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div>
      <StageHeader
        title="Drafts"
        sentence={posts.length ? `${posts.length} article${posts.length === 1 ? "" : "s"} in progress — review happens one stage on.` : "Nothing being written right now."}
        counts={[
          { label: "drafting", n: n("drafting"), href: "/blog/board", hue: "amber" },
          { label: "in review", n: n("draft_review"), href: "/review", hue: "blue" },
          { label: "scripts", n: scripts.length, href: "/scripts", hue: "green" },
          { label: "renders", n: renders.length, href: "/videos", hue: "violet" },
        ]}
      />

      <StageList title="Articles" empty="No articles are drafting or in review.">
        {posts.length > 0 ? posts.map((p) => (
          <StageRow key={p.id}>
            <StateChip label={p.status === "draft_review" ? "in review" : "drafting"} hue={BLOG_HUE[p.status] ?? "zebra"} />
            <div className="flex-1 min-w-48">
              <Link href={`/blog/${p.id}`} className="text-sm font-semibold hover:underline line-clamp-1">{p.title}</Link>
              <div className="text-[11px] text-[var(--mute)]">
                {p.body ? `${Math.round(p.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length)} words` : "no body yet"} · updated {p.updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </div>
            </div>
            <Link href={`/blog/${p.id}`} className="btn sm">Open</Link>
          </StageRow>
        )) : undefined}
      </StageList>

      {scripts.length > 0 && (
        <StageList title="Scripts">
          {scripts.map((s) => (
            <StageRow key={s.id}>
              <StateChip label={s.workflow} hue="green" />
              <div className="flex-1 min-w-48">
                <Link href={s.workflow === "builder" ? `/scripts/${s.id}/builder` : `/scripts/${s.id}`} className="text-sm font-semibold hover:underline line-clamp-1">{s.title}</Link>
                <div className="text-[11px] text-[var(--mute)]">{s.channel.name} · {s.wordCount} words</div>
              </div>
              <Link href={s.workflow === "builder" ? `/scripts/${s.id}/builder` : `/scripts/${s.id}`} className="btn sm">Open</Link>
            </StageRow>
          ))}
        </StageList>
      )}

      {renders.length > 0 && (
        <StageList title="Video renders">
          {renders.map((r) => (
            <StageRow key={r.id}>
              <StateChip label={r.status} hue={r.status === "rendering" ? "amber" : "violet"} />
              <div className="flex-1 min-w-48 text-sm">Render started {r.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              <Link href={`/videos/${r.id}`} className="btn sm">Open</Link>
            </StageRow>
          ))}
        </StageList>
      )}

      <AskDrawer stage="drafts" placeholder="e.g. Draft the article for the approved idea about donor fatigue." />
    </div>
  );
}
