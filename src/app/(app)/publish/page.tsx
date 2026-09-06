import Link from "next/link";
import { requireMembership, canAdmin } from "@/lib/acl";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getModes } from "@/lib/governance";
import { SubmitButton } from "@/components/SubmitButton";
import { advanceBlogStatusAction } from "@/app/actions/blog";
import { AskDrawer, StageHeader, StageList, StageRow, StateChip } from "@/components/StageShell";

// Publish stage: what's at final approval, when it goes (the publish-day
// gate, or a hand-set date), and what went live. Website, the blog calendar
// and Automation are its tabs.

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function PublishStage() {
  const { workspace, membership } = await requireMembership();
  const admin = canAdmin(membership.role);
  const [ready, published, wp, publishDayRaw, modes] = await Promise.all([
    db.blogPost.findMany({ where: { workspaceId: workspace.id, status: "final_approval" }, orderBy: { updatedAt: "asc" }, take: 10, select: { id: true, title: true, scheduledAt: true, wpPostId: true } }),
    db.blogPost.findMany({ where: { workspaceId: workspace.id, status: "published" }, orderBy: { publishedAt: "desc" }, take: 6, select: { id: true, title: true, publishedAt: true, publishedUrl: true } }),
    db.wordPressConnection.findUnique({ where: { workspaceId: workspace.id }, select: { baseUrl: true } }),
    getSetting("autopilot:publish_day", workspace.id).catch(() => ""),
    getModes(workspace.id),
  ]);
  const day = parseInt(publishDayRaw, 10);
  const publishDay = Number.isInteger(day) && day >= 0 && day <= 6 ? DAYS[day] : null;
  const auto = modes.publishing === "auto";

  return (
    <div>
      <StageHeader
        title="Publish"
        sentence={
          !wp
            ? "No website connected — articles reaching final approval park here until WordPress is connected under Website."
            : auto
              ? publishDay ? `Publishing is automatic: gate-passing articles go to ${wp.baseUrl} on ${publishDay}s.` : `Publishing is automatic: gate-passing articles go to ${wp.baseUrl} on the next cycle.`
              : `Publishing is ${modes.publishing}: a person sets the date or presses Publish.`
        }
        counts={[
          { label: "at final approval", n: ready.length, hue: "blue" },
          { label: "published", n: published.length, href: "/blog", hue: "green" },
          { label: publishDay ? `publish day · ${publishDay}` : "publish day · any", n: null, href: "/setup/automation" },
        ]}
      />

      <StageList title="Waiting to go out" empty="Nothing at final approval. Articles arrive here once every required check passes.">
        {ready.length > 0 ? ready.map((p) => (
          <StageRow key={p.id}>
            <StateChip label="final approval" hue="blue" />
            <div className="flex-1 min-w-48">
              <Link href={`/blog/${p.id}`} className="text-sm font-semibold hover:underline line-clamp-1">{p.title}</Link>
              <div className="text-[11px] text-[var(--mute)]">
                {!wp
                  ? "no website connected — cannot publish yet"
                  : p.scheduledAt
                    ? `set for ${p.scheduledAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : auto
                      ? publishDay ? `goes out ${publishDay} with the cycle` : "goes out on the next cycle"
                      : "waiting for a person"}
              </div>
            </div>
            {admin && wp && (
              <form action={advanceBlogStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton className="btn primary sm" pendingText="Publishing…" title="Publish to WordPress now, ahead of the gate">Publish now</SubmitButton>
              </form>
            )}
            <Link href={`/blog/${p.id}`} className="btn sm">Open</Link>
          </StageRow>
        )) : undefined}
      </StageList>

      {published.length > 0 && (
        <StageList title="Recently published">
          {published.map((p) => (
            <StageRow key={p.id}>
              <StateChip label="published" hue="green" />
              <div className="flex-1 min-w-48">
                <Link href={`/blog/${p.id}`} className="text-sm font-semibold hover:underline line-clamp-1">{p.title}</Link>
                <div className="text-[11px] text-[var(--mute)]">{p.publishedAt?.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) ?? "—"}</div>
              </div>
              {p.publishedUrl && <a href={p.publishedUrl} target="_blank" rel="noopener noreferrer" className="btn sm">View live ↗</a>}
            </StageRow>
          ))}
        </StageList>
      )}

      <AskDrawer stage="publish" placeholder="e.g. What's publishing this Wednesday and is anything holding it?" />
    </div>
  );
}
