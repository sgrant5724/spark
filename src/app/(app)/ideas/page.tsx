import Link from "next/link";
import { requireMembership, canEdit } from "@/lib/acl";
import { getActiveChannel } from "@/lib/channel";
import { db } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { draftFromIdeaAction, setBlogIdeaStatusAction } from "@/app/actions/blog-ideas";
import { AskDrawer, StageHeader, StageList, StageRow, StateChip } from "@/components/StageShell";

// Ideas stage. Until step 4 merges the two boards into one, this overview
// shows blog ideas by state with their verbs inline, and the video ideas per
// channel one click away — one stage, both boards, as the owner decided.
// (This route used to be a bare redirect to the active channel's video ideas.)

export default async function IdeasStage() {
  const { workspace, membership } = await requireMembership();
  const { active, channels } = await getActiveChannel();
  const editor = canEdit(membership.role);
  const [discovered, approved, counts, videoCounts] = await Promise.all([
    db.blogIdea.findMany({ where: { workspaceId: workspace.id, status: "discovered" }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 8 }),
    db.blogIdea.findMany({ where: { workspaceId: workspace.id, status: "approved" }, orderBy: { createdAt: "asc" }, take: 8 }),
    db.blogIdea.groupBy({ by: ["status"], where: { workspaceId: workspace.id }, _count: { _all: true } }),
    Promise.all(channels.map(async (c) => ({ id: c.id, name: c.name, n: await db.idea.count({ where: { channelId: c.id } }) }))),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div>
      <StageHeader
        title="Ideas"
        sentence={n("approved") > 0 ? `${n("approved")} approved idea${n("approved") === 1 ? "" : "s"} feed the autopilot's weekly draft.` : "Approve an idea and the autopilot drafts it on its next allowance."}
        counts={[
          { label: "discovered", n: n("discovered"), href: "/blog/ideas", hue: "amber" },
          { label: "approved", n: n("approved"), href: "/blog/ideas", hue: "blue" },
          { label: "drafted", n: n("drafted"), href: "/blog/board", hue: "green" },
          ...videoCounts.map((v) => ({ label: `video ideas · ${v.name}`, n: v.n, href: `/channels/${v.id}/ideas`, hue: "violet" })),
        ]}
        tabs={[
          { href: "/blog/ideas", label: "Blog ideas" },
          ...(active ? [{ href: `/channels/${active.id}/ideas`, label: "Video ideas" }] : []),
          { href: "/blog/keywords", label: "Keywords" },
          { href: "/blog/experts", label: "Experts" },
        ]}
      />

      <StageList title="Discovered — waiting for a yes or no" empty="Nothing discovered. Add one on Blog → Ideas, or let ideation top up the pool.">
        {discovered.length > 0 ? discovered.map((i) => (
          <StageRow key={i.id}>
            <StateChip label="discovered" hue="amber" />
            <div className="flex-1 min-w-48">
              <div className="text-sm font-semibold leading-snug">{i.title}</div>
              {i.angle && <div className="text-[11px] text-[var(--mute)] line-clamp-1">{i.angle}</div>}
            </div>
            {editor && (
              <>
                <form action={setBlogIdeaStatusAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="status" value="approved" />
                  <SubmitButton className="btn primary sm" pendingText="…">Approve</SubmitButton>
                </form>
                <form action={setBlogIdeaStatusAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <SubmitButton className="btn sm" pendingText="…">Reject</SubmitButton>
                </form>
              </>
            )}
          </StageRow>
        )) : undefined}
      </StageList>

      <StageList title="Approved — next in line to draft" empty="Nothing approved yet.">
        {approved.length > 0 ? approved.map((i) => (
          <StageRow key={i.id}>
            <StateChip label="approved" hue="blue" />
            <div className="flex-1 min-w-48">
              <div className="text-sm font-semibold leading-snug">{i.title}</div>
              {i.keyword && <div className="text-[11px] text-[var(--mute)] font-mono">{i.keyword}</div>}
            </div>
            {editor && (
              <form action={draftFromIdeaAction}>
                <input type="hidden" name="id" value={i.id} />
                <SubmitButton className="btn sm" pendingText="Drafting…" title="Draft it now instead of waiting for the autopilot's allowance">Send to draft</SubmitButton>
              </form>
            )}
          </StageRow>
        )) : undefined}
      </StageList>

      {videoCounts.length > 0 && (
        <p className="text-[11px] text-[var(--mute)] mb-4">
          Video ideas stay on their channel boards until the two boards merge:{" "}
          {videoCounts.map((v, i) => (
            <span key={v.id}>{i > 0 ? " · " : ""}<Link href={`/channels/${v.id}/ideas`} className="underline">{v.name}</Link> ({v.n})</span>
          ))}
        </p>
      )}

      <AskDrawer stage="ideas" placeholder="e.g. Add an idea about grant reporting deadlines for small nonprofits." />
    </div>
  );
}
