import Link from "next/link";
import { requireMembership } from "@/lib/acl";
import { db } from "@/lib/db";
import { getPostingTimeZone, formatInZone } from "@/lib/social/slots";
import { networkFor } from "@/lib/social/networks";
import { AskDrawer, StageHeader, StageList, StageRow, StateChip } from "@/components/StageShell";

// Distribute stage: the queue on the slot grid, the drafts behind it, and the
// replies waiting. Compose, Calendar, Engage, Performance and Settings are its
// tabs — their URLs unchanged.

export default async function DistributeStage() {
  const { workspace } = await requireMembership();
  const now = new Date();
  const [tz, scheduled, drafts, unread, accounts] = await Promise.all([
    getPostingTimeZone(workspace.id),
    db.socialPost.findMany({
      where: { workspaceId: workspace.id, status: "scheduled", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      include: { targets: { select: { provider: true } } },
    }),
    db.socialPost.count({ where: { workspaceId: workspace.id, status: "draft" } }),
    db.socialInboxEvent.count({ where: { workspaceId: workspace.id, readAt: null } }),
    db.zernioAccount.count({ where: { workspaceId: workspace.id, status: "connected" } }),
  ]);

  return (
    <div>
      <StageHeader
        title="Distribute"
        sentence={
          accounts === 0
            ? "No social accounts connected — connect one under Admin → Connections and the queue comes alive."
            : scheduled.length
              ? `Next send ${formatInZone(scheduled[0].scheduledAt!, tz)} (${tz}) — ${scheduled.length} in the queue.`
              : "Nothing in the queue. Approved drafts take the next free slot; compose one or queue a draft."
        }
        counts={[
          { label: "scheduled", n: scheduled.length, href: "/social/calendar", hue: "blue" },
          { label: "drafts", n: drafts, href: "/social/calendar", hue: "amber" },
          { label: "replies waiting", n: unread, href: "/social/engage", hue: "cyan" },
          { label: "accounts", n: accounts, href: "/admin/connections", hue: "green" },
        ]}
        tabs={[
          { href: "/social/compose", label: "Compose" },
          { href: "/social/calendar", label: "Calendar" },
          { href: "/social/engage", label: "Engage" },
          { href: "/social/performance", label: "Performance" },
          { href: "/social/settings", label: "Slots & settings" },
        ]}
      />

      <StageList title="The queue" empty="Nothing scheduled.">
        {scheduled.length > 0 ? scheduled.map((p) => (
          <StageRow key={p.id}>
            <StateChip label={formatInZone(p.scheduledAt!, tz)} hue="blue" />
            <div className="flex-1 min-w-48">
              <div className="text-sm leading-snug line-clamp-2">{p.text}</div>
              <div className="text-[11px] text-[var(--mute)]">
                {[...new Set(p.targets.map((t) => t.provider))].map((x) => networkFor(x)?.label ?? x).join(" · ") || "no network chosen"}
                {p.recycledFromId ? " · evergreen recycle" : ""}
              </div>
            </div>
            <Link href={`/social/${p.id}/edit`} className="btn sm">Open</Link>
          </StageRow>
        )) : undefined}
      </StageList>

      {unread > 0 && (
        <p className="text-xs mb-4">
          <b>{unread}</b> repl{unread === 1 ? "y is" : "ies are"} waiting under <Link href="/social/engage" className="underline">Engage</Link> — Facebook and Instagram DMs can only be answered within 24 hours of the person&apos;s message.
        </p>
      )}

      <AskDrawer stage="distribute" placeholder="e.g. Draft a LinkedIn post about this week's article." />
    </div>
  );
}
