import {
  SeoPlugin,
  BlogSlugRule,
  RenderingType,
  withWorkspace,
} from "@spark/db";
import { can, BRAND } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import {
  saveBrandKit,
  saveImageSpec,
  saveHeadingStyles,
  saveSeoSettings,
  saveRenderingProfile,
  saveMotifs,
} from "./actions";

const inputCls =
  "w-full rounded-lg border border-lightblue px-3 py-2 text-sm text-ink outline-none focus:border-blue disabled:bg-paper disabled:text-ink/60";
const labelCls =
  "mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-brand border border-lightblue bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {desc && <p className="mb-3 mt-1 text-sm text-ink/60">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function SaveBar({ canManage }: { canManage: boolean }) {
  if (!canManage) return null;
  return (
    <div className="mt-4">
      <button
        type="submit"
        className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
      >
        Save
      </button>
    </div>
  );
}

export default async function SettingsPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const canManage = can(membership.role, "workspace.manage");
  const disabled = !canManage;

  const cfg = await withWorkspace(db, workspaceId, async (tx) => {
    const brand = await tx.brandKit.findUnique({ where: { workspaceId } });
    const image = await tx.imageSpec.findUnique({ where: { workspaceId } });
    const headings = await tx.headingStyle.findMany({
      where: { workspaceId },
      orderBy: { level: "asc" },
    });
    const seo = await tx.seoSettings.findUnique({ where: { workspaceId } });
    const profiles = await tx.renderingProfile.findMany({
      where: { workspaceId },
    });
    const motifs = await tx.motif.findMany({
      where: { workspaceId },
      orderBy: { position: "asc" },
    });
    const motifDefaults = await tx.motifDefault.findMany({
      where: { workspaceId },
    });
    return { brand, image, headings, seo, profiles, motifs, motifDefaults };
  });

  const colorsRaw = (cfg.brand?.colors as Record<string, string>) ?? {};
  const colors = Object.keys(colorsRaw).length ? colorsRaw : (BRAND as Record<string, string>);
  const headingByLevel = Object.fromEntries(cfg.headings.map((h) => [h.level, h]));
  const profileType =
    (cfg.profiles.find((p) => p.isDefault) ?? cfg.profiles[0])?.type ??
    RenderingType.html;
  const slugRule = cfg.seo?.blogSlugRule ?? BlogSlugRule.needs_confirmation;

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">
          Workspace settings
        </h1>
        <span className="rounded-lg border border-lightblue bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-blue">
          {membership.role}
        </span>
      </header>

      {!canManage && (
        <p className="mb-5 rounded-lg border border-orange/40 bg-orange/5 px-4 py-2 text-sm text-orange">
          You have read-only access. Only owners and admins can change settings.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Brand kit & images */}
        <Section title="Brand kit" desc="Palette, logo, and footer credit.">
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(colors).map(([name, hex]) => (
              <span
                key={name}
                className="flex items-center gap-2 rounded-lg border border-lightblue bg-paper px-2 py-1 text-[0.65rem] text-ink/70"
              >
                <i
                  className="h-4 w-4 rounded"
                  style={{ background: String(hex) }}
                />
                {name}
              </span>
            ))}
          </div>
          <form action={saveBrandKit}>
            <input type="hidden" name="slug" value={slug} />
            <label className="mb-3 block">
              <span className={labelCls}>Logo URL</span>
              <input
                name="logoUrl"
                defaultValue={cfg.brand?.logoUrl ?? ""}
                disabled={disabled}
                className={inputCls}
                placeholder="https://…"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Footer credit</span>
              <input
                name="footerCredit"
                defaultValue={cfg.brand?.footerCredit ?? ""}
                disabled={disabled}
                className={inputCls}
              />
            </label>
            <SaveBar canManage={canManage} />
          </form>
        </Section>

        {/* Image dimensions */}
        <Section
          title="Image dimensions"
          desc="Required featured + branded OG sizes (px). Editable per workspace."
        >
          <form action={saveImageSpec}>
            <input type="hidden" name="slug" value={slug} />
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelCls}>Featured width</span>
                <input name="featuredW" type="number" min="1" defaultValue={cfg.image?.featuredW ?? 1920} disabled={disabled} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Featured height</span>
                <input name="featuredH" type="number" min="1" defaultValue={cfg.image?.featuredH ?? 1080} disabled={disabled} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>OG width</span>
                <input name="ogW" type="number" min="1" defaultValue={cfg.image?.ogW ?? 1200} disabled={disabled} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>OG height</span>
                <input name="ogH" type="number" min="1" defaultValue={cfg.image?.ogH ?? 630} disabled={disabled} className={inputCls} />
              </label>
            </div>
            <div className="mt-3 space-y-2 text-sm text-ink/80">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="brandOg" defaultChecked={cfg.image?.brandOg ?? true} disabled={disabled} />
                Brand the OG image (logo/lockup) — required for social previews
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="brandInbody" defaultChecked={cfg.image?.brandInbody ?? false} disabled={disabled} />
                Brand in-body / featured images
              </label>
            </div>
            <SaveBar canManage={canManage} />
          </form>
        </Section>

        {/* Heading styles */}
        <Section
          title="Heading styles (article)"
          desc="Pixel size + top/bottom margins per level. Visual only — semantic H-order is always preserved."
        >
          <form action={saveHeadingStyles}>
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[0.6rem] uppercase tracking-wide text-ink/50">
                <span>Level</span><span>Font px</span><span>Margin top</span><span>Margin bottom</span>
              </div>
              {[1, 2, 3, 4, 5, 6].map((lvl) => {
                const h = headingByLevel[lvl];
                return (
                  <div key={lvl} className="grid grid-cols-4 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">H{lvl}</span>
                    <input name={`h${lvl}_font`} type="number" min="1" defaultValue={h?.fontPx ?? 16} disabled={disabled} className={inputCls} />
                    <input name={`h${lvl}_mt`} type="number" min="0" defaultValue={h?.marginTopPx ?? 0} disabled={disabled} className={inputCls} />
                    <input name={`h${lvl}_mb`} type="number" min="0" defaultValue={h?.marginBottomPx ?? 0} disabled={disabled} className={inputCls} />
                  </div>
                );
              })}
            </div>
            <SaveBar canManage={canManage} />
          </form>
        </Section>

        {/* Rendering profile + SEO */}
        <Section title="Design elements & SEO" desc="Rendering profile, SEO plugin, and the blog URL rule.">
          <form action={saveRenderingProfile} className="mb-5">
            <input type="hidden" name="slug" value={slug} />
            <label className="block">
              <span className={labelCls}>Rendering profile (FR-18)</span>
              <select name="type" defaultValue={profileType} disabled={disabled} className={inputCls}>
                <option value={RenderingType.avada_fusion}>Avada / Fusion Builder</option>
                <option value={RenderingType.gutenberg}>Gutenberg blocks</option>
                <option value={RenderingType.html}>Clean semantic HTML</option>
              </select>
            </label>
            <SaveBar canManage={canManage} />
          </form>

          <form action={saveSeoSettings}>
            <input type="hidden" name="slug" value={slug} />
            <label className="mb-3 block">
              <span className={labelCls}>SEO plugin (FR-7)</span>
              <select name="plugin" defaultValue={cfg.seo?.plugin ?? SeoPlugin.squirrly} disabled={disabled} className={inputCls}>
                <option value={SeoPlugin.squirrly}>Squirrly</option>
                <option value={SeoPlugin.rank_math}>Rank Math</option>
                <option value={SeoPlugin.yoast}>Yoast</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Blog URL / slug rule</span>
              <select name="blogSlugRule" defaultValue={slugRule} disabled={disabled} className={inputCls}>
                <option value={BlogSlugRule.root}>Root-level /{"{slug}"}/</option>
                <option value={BlogSlugRule.blog_prefix}>/blog/{"{slug}"}/</option>
                <option value={BlogSlugRule.needs_confirmation}>Needs confirmation</option>
              </select>
            </label>
            {slugRule === BlogSlugRule.needs_confirmation && (
              <p className="mt-2 text-xs text-orange">
                ⚠ Confirm against the live site before publishing — this drives
                slugs, canonicals, internal links, and redirects.
              </p>
            )}
            <SaveBar canManage={canManage} />
          </form>
        </Section>

        {/* Motif management */}
        <Section
          title="7 Motifs™ — voice directives"
          desc="Edit each motif's display name and voice signature. These steer generation."
        >
          <form action={saveMotifs}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="motifIds" value={cfg.motifs.map((m) => m.id).join(",")} />
            <div className="space-y-3">
              {cfg.motifs.map((m) => {
                const voice = String(
                  (m.directive as Record<string, unknown>)?.voice ?? "",
                );
                return (
                  <div key={m.id} className="rounded-lg border border-lightblue p-3">
                    <div className="grid grid-cols-[1fr_2fr] gap-2">
                      <label>
                        <span className={labelCls}>Name ({m.key})</span>
                        <input name={`motif_${m.id}_name`} defaultValue={m.name} disabled={disabled} className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Voice signature</span>
                        <input name={`motif_${m.id}_voice`} defaultValue={voice} disabled={disabled} className={inputCls} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveBar canManage={canManage} />
          </form>
        </Section>

        {/* Motif defaults (read-only for now) */}
        <Section
          title="Default motifs"
          desc="Default motif mix by tier / audience and per channel. Inline editing is coming."
        >
          {cfg.motifDefaults.length === 0 ? (
            <p className="text-sm text-ink/60">No defaults configured.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {cfg.motifDefaults.map((d) => {
                const mix = (d.motifMix as Record<string, number>) ?? {};
                const label =
                  d.channel
                    ? `Channel: ${d.channel}`
                    : `${d.tier ? `Tier ${d.tier}` : "Any tier"}${d.audience ? ` · ${d.audience}` : ""}`;
                return (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-lightblue px-3 py-2">
                    <span className="text-ink">{label}</span>
                    <span className="text-blue">
                      {Object.entries(mix)
                        .map(([k, v]) => `${k} ${Math.round(Number(v) * 100)}%`)
                        .join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Integrations (V1) */}
        <Section title="Integrations" desc="WordPress, GSC/GA4, Nifty, Uniple, YouTube.">
          <p className="text-sm text-ink/60">
            Connections are configured here in a later epic (V1). They&apos;ll be
            stored as encrypted, per-workspace OAuth tokens.
          </p>
        </Section>
      </div>
    </div>
  );
}
