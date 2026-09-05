import { requireMembership, canAdmin, canEdit } from "@/lib/acl";
import { getInboxData } from "@/lib/inbox";
import { getPublicUrl } from "@/lib/public-url";
import { NeedsYouGroups } from "@/components/NeedsYou";
import { AskDrawer, StageHeader } from "@/components/StageShell";

// Review stage: the review-stage subset of the Inbox — posts awaiting
// approval, questions, unsourced claims, images, held articles — the same
// cards, so the two never drift. Approvals and Audit are its tabs.

export default async function ReviewStage() {
  const { workspace, membership } = await requireMembership();
  const admin = canAdmin(membership.role);
  const editor = canEdit(membership.role);
  const [inbox, origin] = await Promise.all([getInboxData(workspace.id, { admin }), getPublicUrl()]);
  const items = inbox.socialPosts.length + inbox.questions.length + inbox.citations.length + inbox.images.length + inbox.articles.length;
  const ready = inbox.articles.filter((a) => a.failing.length === 0).length;

  return (
    <div>
      <StageHeader
        title="Review"
        sentence={items === 0 ? "Nothing is waiting for review. Auto-review handles what it can; the rest reaches you here." : `${items} item${items === 1 ? "" : "s"} waiting on a person — the engine has already done what it could.`}
        counts={[
          { label: "posts to approve", n: inbox.socialPosts.length, href: "/social/approvals", hue: "violet" },
          { label: "questions", n: inbox.questions.length, hue: "amber" },
          { label: "unsourced claims", n: inbox.citations.length, hue: "rose" },
          { label: "images", n: inbox.images.length, hue: "blue" },
          { label: "articles held", n: inbox.articles.length - ready, hue: "rose" },
          { label: "ready to advance", n: ready, hue: "green" },
        ]}
        tabs={[
          { href: "/social/approvals", label: "Approvals" },
          { href: "/blog/audit", label: "Audit" },
        ]}
      />
      <NeedsYouGroups
        inbox={inbox}
        admin={admin}
        editor={editor}
        timeZone={inbox.home.social.timeZone}
        origin={origin}
        include={["posts", "questions", "citations", "images", "articles"]}
      />
      {items === 0 && (
        <p className="text-xs text-[var(--mute)] mb-4">Articles that pass every required check advance on the autopilot&apos;s next cycle without anyone clicking.</p>
      )}
      <AskDrawer stage="review" placeholder="e.g. Why is the giving-campaign article still held?" />
    </div>
  );
}
