import { withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { saveOrgProfile } from "./actions";

const inputCls =
  "w-full rounded-lg border border-lightblue px-3 py-2 text-sm text-ink outline-none focus:border-blue disabled:bg-paper disabled:text-ink/60";
const labelCls = "mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60";

type Item = { name: string; blurb?: string };
const toLines = (v: unknown) =>
  Array.isArray(v)
    ? (v as Item[])
        .map((s) => (s.blurb ? `${s.name} — ${s.blurb}` : s.name))
        .join("\n")
    : "";

export default async function OrganizationPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const canManage = can(membership.role, "workspace.manage");
  const disabled = !canManage;

  const profile = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.orgProfile.findUnique({ where: { workspaceId: membership.workspaceId } }),
  );

  const complete =
    !!profile?.description &&
    !!profile?.industry &&
    Array.isArray(profile?.services) &&
    (profile.services as unknown[]).length > 0;

  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">
          Organization profile
        </h1>
        <span
          className={
            "rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wide " +
            (complete
              ? "border-lightblue bg-white text-blue"
              : "border-orange/40 bg-orange/5 text-orange")
          }
        >
          {complete ? "Ready for AI grounding" : "Incomplete — AI output will be generic"}
        </span>
      </header>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        What this client does. Every AI output for this workspace — topic ideas,
        drafts, social copy — is grounded in this profile, so specific beats
        generic. Only real credentials; nothing here may be invented.
      </p>

      <form action={saveOrgProfile} className="max-w-3xl space-y-4">
        <input type="hidden" name="slug" value={slug} />

        <label className="block">
          <span className={labelCls}>What the company does (plain language)</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={profile?.description ?? ""}
            disabled={disabled}
            placeholder="e.g. LSI Media is a digital agency helping nonprofits and federal contractors with accessible web design, SEO, and content."
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Industry</span>
            <input
              name="industry"
              defaultValue={profile?.industry ?? ""}
              disabled={disabled}
              placeholder="e.g. Digital marketing & accessibility"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Website</span>
            <input
              name="websiteUrl"
              defaultValue={profile?.websiteUrl ?? ""}
              disabled={disabled}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Services — one per line, &ldquo;Name — short blurb&rdquo;</span>
          <textarea
            name="services"
            rows={4}
            defaultValue={toLines(profile?.services)}
            disabled={disabled}
            placeholder={"Accessible web design — WCAG 2.1 AA sites\nSEO strategy — four-tier keyword model"}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Audiences — one per line, &ldquo;Name — notes&rdquo;</span>
          <textarea
            name="audiences"
            rows={3}
            defaultValue={toLines(profile?.audiences)}
            disabled={disabled}
            placeholder={"Nonprofits — mission-driven, budget-aware\nFederal contractors — Section 508 requirements"}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Differentiators — why clients choose them</span>
          <textarea
            name="differentiators"
            rows={2}
            defaultValue={profile?.differentiators ?? ""}
            disabled={disabled}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Credentials (real only — never invented)</span>
          <textarea
            name="credentials"
            rows={2}
            defaultValue={profile?.credentials ?? ""}
            disabled={disabled}
            placeholder="e.g. DHS Trusted Tester, PMP, MBE, Adobe Partner"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Tone notes / brand voice guardrails</span>
          <textarea
            name="toneNotes"
            rows={2}
            defaultValue={profile?.toneNotes ?? ""}
            disabled={disabled}
            placeholder="e.g. Confident but not salesy; avoid jargon; US English"
            className={inputCls}
          />
        </label>

        {canManage ? (
          <button
            type="submit"
            className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
          >
            Save profile
          </button>
        ) : (
          <p className="text-sm text-ink/60">
            Only owners and admins can edit the organization profile.
          </p>
        )}
      </form>
    </div>
  );
}
