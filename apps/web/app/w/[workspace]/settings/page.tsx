import { TriangleAlert } from "lucide-react";
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
import { connectWordPress, disconnectWordPress } from "./integrations-actions";
import { saveLlmProvider, saveLlmKey, clearLlmKey } from "./llm-actions";
import { getLlmSettingsView, KEY_SLOTS, MODEL_OPTIONS } from "@/lib/llm-settings";

const inputCls =
  "w-full rounded-lg border border-lightblue px-3 py-2 text-sm text-ink outline-none focus:border-blue disabled:bg-paper disabled:text-ink/60";
const labelCls =
  "mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60";

function Section({
  title,
  desc,
  children,
  className = "",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-brand border border-lightblue bg-white p-5 ${className}`}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-orange via-yellow to-blue-bright"
        aria-hidden
      />
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
  searchParams,
}: {
  params: { workspace: string };
  searchParams?: { error?: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const canManage = can(membership.role, "workspace.manage");
  const disabled = !canManage;
  const llm = await getLlmSettingsView(workspaceId);

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
    const wpConnection = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
    });
    return { brand, image, headings, seo, profiles, motifs, motifDefaults, wpConnection };
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

      {searchParams?.error && (
        <p
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-brand border border-orange/50 bg-orange/10 px-4 py-3 text-sm text-orange"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {searchParams.error}
        </p>
      )}

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
              <p className="mt-2 flex items-start gap-1.5 text-xs text-orange">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Confirm against the live site before publishing — this drives
                  slugs, canonicals, internal links, and redirects.
                </span>
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

        {/* Integrations */}
        <Section
          title="Integrations — WordPress"
          desc="Connect the workspace's WordPress site with an Application Password (created in wp-admin → Users → Profile). Stored encrypted."
        >
          {cfg.wpConnection ? (
            <div className="space-y-3">
              <p className="text-sm">
                <span
                  className={
                    "inline-flex items-center gap-1.5 " +
                    (cfg.wpConnection.status === "connected" ? "text-blue" : "text-orange")
                  }
                >
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                  {cfg.wpConnection.status}
                </span>{" "}
                <span className="text-ink/70">
                  {String((cfg.wpConnection.config as Record<string, unknown>)?.siteUrl ?? "")}
                </span>
              </p>
              <p className="text-xs text-ink/50">
                {String((cfg.wpConnection.config as Record<string, unknown>)?.detail ?? "")}
              </p>
              {canManage && (
                <form action={disconnectWordPress}>
                  <input type="hidden" name="slug" value={slug} />
                  <button className="rounded-lg border border-orange/40 px-3 py-1.5 text-xs text-orange">
                    Disconnect
                  </button>
                </form>
              )}
            </div>
          ) : canManage ? (
            <form action={connectWordPress} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <label className="block">
                <span className={labelCls}>Site URL</span>
                <input name="siteUrl" required placeholder="https://example.com" className={inputCls} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className={labelCls}>WP username</span>
                  <input name="username" required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Application password</span>
                  <input name="appPassword" type="password" required className={inputCls} />
                </label>
              </div>
              <button className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white">
                Connect &amp; verify
              </button>
              <p className="text-[0.7rem] text-ink/50">
                GSC/GA4, Nifty, Uniple, and YouTube connectors follow in V1.
              </p>
            </form>
          ) : (
            <p className="text-sm text-ink/60">Not connected. Ask an owner/admin.</p>
          )}
        </Section>

        {/* AI Provider */}
        <Section
          title="AI Provider"
          desc="Which Claude model powers generation, and which API key it bills to. Keys are encrypted at rest and never shown again after saving."
          className="lg:col-span-2"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-lightblue bg-blue/5 px-2.5 py-1 font-mono text-blue">
              {llm.model}
            </span>
            <span className="rounded-full border border-lightblue bg-paper px-2.5 py-1 text-ink/70">
              active key:{" "}
              {llm.activeSlot === 0
                ? llm.envKeyPresent
                  ? "deployment key (env)"
                  : "deployment key (env) — NOT SET, generation runs on the stub"
                : `slot ${llm.activeSlot} · ${llm.slots[llm.activeSlot - 1]?.label ?? "?"} · …${llm.slots[llm.activeSlot - 1]?.last4 ?? ""}`}
            </span>
          </div>

          <form action={saveLlmProvider} className="mb-5 rounded-lg border border-paper bg-paper/40 p-3">
            <input type="hidden" name="slug" value={slug} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Model</span>
                <select name="model" defaultValue={llm.model} disabled={disabled} className={inputCls}>
                  {!MODEL_OPTIONS.some((m) => m.id === llm.model) && (
                    <option value={llm.model}>{llm.model} (from env)</option>
                  )}
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.hint}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className={labelCls}>Active API key</legend>
                <div className="space-y-1 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="activeSlot"
                      value="0"
                      defaultChecked={llm.activeSlot === 0}
                      disabled={disabled}
                      className="accent-blue"
                    />
                    <span className="text-ink/80">
                      Deployment key (env){" "}
                      {llm.envKeyPresent ? (
                        <span className="text-blue">· set</span>
                      ) : (
                        <span className="text-orange">· not set</span>
                      )}
                    </span>
                  </label>
                  {llm.slots.map((s, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="activeSlot"
                        value={String(i + 1)}
                        defaultChecked={llm.activeSlot === i + 1}
                        disabled={disabled || !s}
                        className="accent-blue"
                      />
                      <span className={s ? "text-ink/80" : "text-ink/40"}>
                        Slot {i + 1}
                        {s ? (
                          <span>
                            {" "}
                            · {s.label} · <span className="font-mono">…{s.last4}</span>
                          </span>
                        ) : (
                          " · empty"
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <SaveBar canManage={canManage} />
          </form>

          <p className={labelCls}>API key slots (Anthropic keys — write-only)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: KEY_SLOTS }, (_, i) => {
              const s = llm.slots[i];
              return (
                <form
                  key={i}
                  action={saveLlmKey}
                  className={
                    "rounded-lg border p-3 " +
                    (llm.activeSlot === i + 1
                      ? "border-blue bg-blue/5"
                      : s
                        ? "border-lightblue bg-white"
                        : "border-dashed border-lightblue bg-paper/30")
                  }
                >
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="slot" value={String(i + 1)} />
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink/60">
                      Slot {i + 1}
                      {llm.activeSlot === i + 1 && <span className="ml-1 text-blue">· active</span>}
                    </span>
                    {s ? (
                      <span className="font-mono text-[0.65rem] text-blue">…{s.last4}</span>
                    ) : (
                      <span className="text-[0.65rem] text-ink/40">empty</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      name="label"
                      defaultValue={s?.label ?? ""}
                      placeholder={`Label (e.g. "Client billing")`}
                      disabled={disabled}
                      className={inputCls}
                    />
                    <input
                      name="key"
                      type="password"
                      placeholder={s ? "Paste a new key to replace…" : "sk-ant-…"}
                      autoComplete="off"
                      disabled={disabled}
                      className={inputCls + " font-mono"}
                    />
                  </div>
                  {canManage && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-blue px-3 py-1.5 font-display text-xs font-semibold text-white"
                      >
                        {s ? "Replace key" : "Save key"}
                      </button>
                      {s && (
                        <button
                          type="submit"
                          formAction={clearLlmKey}
                          formNoValidate
                          className="rounded-lg border border-orange/40 px-3 py-1.5 text-xs text-orange"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </form>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
