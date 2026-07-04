import { notFound } from "next/navigation";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import {
  ARTICLE_TRANSITIONS,
  can,
  type ArticleStateName,
  type RoleName,
} from "@spark/shared";
import {
  addAsset,
  attachInfographic,
  generateDraft,
  generateSeo,
  publishToWordPress,
  saveArticle,
  verifyCitation,
  transitionArticle,
} from "../actions";
import { runA11yChecks } from "@/lib/checks";
import { mapToPlugin } from "@/lib/seo-plugins";

const inputCls =
  "w-full rounded-lg border border-lightblue px-3 py-2 text-sm text-ink outline-none focus:border-blue";
const labelCls = "mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60";

const TARGET_LABELS: Record<string, string> = {
  drafting: "↩ Request changes (back to drafting)",
  draft_review: "Send to draft review",
  seo_a11y_review: "Approve → SEO + A11y review",
  assets_pending: "Approve → assets",
  final_approval: "Send to final approval",
  scheduled: "✓ Final approve → schedule",
  published: "Publish",
};

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: { workspace: string; id: string };
  searchParams?: { error?: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const role = membership.role as RoleName;
  const canEdit = can(role, "content.edit");

  const data = await withWorkspace(db, workspaceId, async (tx) => {
    const article = await tx.article.findFirst({
      where: { id: params.id, workspaceId },
      include: {
        citations: { orderBy: { createdAt: "asc" } },
        versions: { orderBy: { version: "desc" }, take: 5 },
        seoOutput: true,
        assets: { orderBy: { createdAt: "asc" } },
      },
    });
    const smeProfiles = await tx.smeProfile.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    const spec = await tx.imageSpec.findUnique({ where: { workspaceId } });
    const publishedCount = await tx.article.count({
      where: {
        workspaceId,
        state: { in: ["published", "distributed", "analyzing"] },
        id: { not: params.id },
      },
    });
    const wpConnection = await tx.connection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
      select: { status: true, config: true },
    });
    const seoSettings = await tx.seoSettings.findUnique({ where: { workspaceId } });
    return { article, smeProfiles, spec, publishedCount, wpConnection, seoSettings };
  });
  if (!data.article) notFound();
  const article = data.article;

  const unverified = article.citations.filter((c) => !c.verified);
  const a11y = runA11yChecks(article.body, article.title);
  const seo = article.seoOutput;
  const featured = article.assets.find((a) => a.kind === "featured");
  const og = article.assets.find((a) => a.kind === "og");
  const infographic = article.assets.find(
    (a) => a.kind === "inbody" && a.url?.includes("infographic.svg"),
  );
  // Every 3rd article gets an infographic (workspace-wide cadence).
  const infographicDue = (data.publishedCount + 1) % 3 === 0;
  const targets = (ARTICLE_TRANSITIONS[article.state as ArticleStateName] ?? []).filter(
    (t) => TARGET_LABELS[t],
  );
  const motifMix = (article.motifMix as Record<string, number>) ?? {};

  return (
    <div className="px-8 py-8">
      {searchParams?.error && (
        <p
          role="alert"
          className="mb-4 rounded-brand border border-orange/50 bg-orange/10 px-4 py-3 text-sm text-orange"
        >
          ⚠ {searchParams.error}
        </p>
      )}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{article.title}</h1>
          <p className="mt-1 text-sm text-ink/60">
            State: <strong className="text-blue">{article.state}</strong>
            {article.tier ? ` · Tier ${article.tier}` : ""}
            {article.audience ? ` · ${article.audience}` : ""}
            {article.versions[0] ? ` · v${article.versions[0].version}` : ""}
          </p>
        </div>
        {canEdit && (
          <form action={generateDraft}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={article.id} />
            <button className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white">
              {article.body ? "⟳ Regenerate draft" : "✦ Generate draft"}
            </button>
          </form>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* Editor */}
        <form action={saveArticle} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={article.id} />
          <label className="block">
            <span className={labelCls}>Title (H1)</span>
            <input name="title" defaultValue={article.title} required disabled={!canEdit} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Body (semantic HTML — starts at H2)</span>
            <textarea
              name="body"
              rows={24}
              defaultValue={article.body ?? ""}
              disabled={!canEdit}
              placeholder="Generate a draft, or write here…"
              className={inputCls + " font-mono text-xs leading-relaxed"}
            />
          </label>
          <label className="block max-w-xs">
            <span className={labelCls}>SME grounding</span>
            <select
              name="smeProfileId"
              defaultValue={article.smeProfileId ?? ""}
              disabled={!canEdit}
              className={inputCls}
            >
              <option value="">No SME selected</option>
              {data.smeProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.title ? ` — ${p.title}` : ""}
                </option>
              ))}
            </select>
          </label>
          {canEdit && (
            <button className="rounded-lg bg-blue px-4 py-2 font-display text-sm font-semibold text-white">
              Save (new version)
            </button>
          )}
        </form>

        {/* Side panel */}
        <aside className="space-y-4">
          <section className="rounded-brand border border-lightblue bg-white p-4">
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">Motif voice</h2>
            {Object.keys(motifMix).length ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(motifMix).map(([k, w]) => (
                  <span key={k} className="rounded-full border border-lightblue bg-paper px-2.5 py-1 text-xs text-blue">
                    {k} {Math.round(Number(w) * 100)}%
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink/50">No motif mix set (defaults apply).</p>
            )}
          </section>

          <section className="rounded-brand border border-lightblue bg-white p-4">
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">
              Source dossier{" "}
              {unverified.length > 0 ? (
                <span className="text-orange">· {unverified.length} unverified</span>
              ) : (
                <span className="text-blue">· all verified</span>
              )}
            </h2>
            {article.citations.length === 0 ? (
              <p className="text-xs text-ink/50">
                No evidence-bearing claims flagged. Claims marked [NEEDS SOURCE]
                during generation appear here and block publishing until verified.
              </p>
            ) : (
              <ul className="space-y-3">
                {article.citations.map((c) => (
                  <li key={c.id} className="border-t border-paper pt-2 first:border-t-0 first:pt-0">
                    <p className="text-xs text-ink">{c.claimText}</p>
                    {c.verified ? (
                      <p className="mt-1 text-[0.65rem] text-blue">✓ {c.sourceUrl}</p>
                    ) : canEdit ? (
                      <form action={verifyCitation} className="mt-1 flex gap-1">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="articleId" value={article.id} />
                        <input
                          name="sourceUrl"
                          required
                          placeholder="https://source…"
                          className="w-full rounded border border-lightblue px-2 py-1 text-[0.65rem] outline-none focus:border-blue"
                        />
                        <button className="rounded bg-blue px-2 py-1 text-[0.65rem] font-semibold text-white">
                          Verify
                        </button>
                      </form>
                    ) : (
                      <p className="mt-1 text-[0.65rem] text-orange">Needs source</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-brand border border-lightblue bg-white p-4">
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">Accessibility (WCAG 2.1 AA)</h2>
            <ul className="space-y-1.5">
              {a11y.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs">
                  <span className={c.pass ? "text-blue" : "text-orange"} aria-hidden>
                    {c.pass ? "✓" : "✕"}
                  </span>
                  <span className={c.pass ? "text-ink/70" : "text-orange"}>
                    {c.label}
                    {!c.pass && c.detail ? ` — ${c.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-brand border border-lightblue bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">SEO</h2>
              {canEdit && (
                <form action={generateSeo}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={article.id} />
                  <button className="rounded bg-blue px-2.5 py-1 text-[0.65rem] font-semibold text-white">
                    {seo ? "Regenerate" : "Generate SEO fields"}
                  </button>
                </form>
              )}
            </div>
            {!seo ? (
              <p className="text-xs text-ink/50">
                Slug, title, meta, focus keyword, and internal links — derived
                from the strategy workbook, never invented.
              </p>
            ) : (
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">
                    Title · {seo.title?.length ?? 0}/60
                  </dt>
                  <dd className="text-ink">{seo.title}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">
                    Meta · {seo.meta?.length ?? 0}/155
                  </dt>
                  <dd className="text-ink">{seo.meta || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">Slug</dt>
                  <dd className="text-ink">{seo.slug}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">Focus keyword</dt>
                  <dd className="text-ink">{seo.focusKeyword ?? "— none matched"}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">Internal links</dt>
                  <dd className="text-ink">
                    {((seo.internalLinks as Array<{ url: string }>) ?? [])
                      .map((l) => l.url)
                      .join(" · ") || "—"}
                  </dd>
                </div>
                {seo.publisherNotes && (
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-wide text-ink/50">Publisher notes</dt>
                    <dd className="whitespace-pre-line text-ink/70">{seo.publisherNotes}</dd>
                  </div>
                )}
                <details className="pt-1">
                  <summary className="cursor-pointer text-[0.65rem] font-semibold text-blue">
                    Plugin fields ({data.seoSettings?.plugin ?? "squirrly"}) — set on publish
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-[0.62rem] text-ink/60">
                    {mapToPlugin(data.seoSettings?.plugin ?? "squirrly", {
                      title: seo.title,
                      meta: seo.meta,
                      focusKeyword: seo.focusKeyword,
                      canonical: seo.canonical,
                      ogTitle: seo.ogTitle,
                      ogDesc: seo.ogDesc,
                    }).map((f) => (
                      <li key={f.key}>
                        <code className="text-blue">{f.key}</code> = {f.value.slice(0, 60)}
                        {f.value.length > 60 ? "…" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </dl>
            )}
          </section>

          <section className="rounded-brand border border-lightblue bg-white p-4">
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">
              Assets (required to publish)
            </h2>
            <ul className="space-y-3 text-xs">
              {(
                [
                  ["featured", featured, `${data.spec?.featuredW ?? 1920}×${data.spec?.featuredH ?? 1080}`],
                  ["og", og, `${data.spec?.ogW ?? 1200}×${data.spec?.ogH ?? 630} · branded`],
                ] as const
              ).map(([kind, asset, dims]) => (
                <li key={kind} className="border-t border-paper pt-2 first:border-t-0 first:pt-0">
                  <p className="flex items-center gap-2">
                    <span className={asset ? "text-blue" : "text-orange"} aria-hidden>
                      {asset ? "✓" : "○"}
                    </span>
                    <span className="font-semibold uppercase tracking-wide text-ink/70">
                      {kind === "og" ? "OG image" : "Featured image"}
                    </span>
                    <span className="text-ink/40">{dims}px</span>
                  </p>
                  {asset ? (
                    <p className="mt-1 break-all text-[0.65rem] text-ink/60">
                      {asset.url} · alt: “{asset.altText}”
                    </p>
                  ) : canEdit ? (
                    <form action={addAsset} className="mt-1 space-y-1">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <input
                        name="url"
                        required
                        placeholder="Image URL…"
                        className="w-full rounded border border-lightblue px-2 py-1 text-[0.65rem] outline-none focus:border-blue"
                      />
                      <div className="flex gap-1">
                        <input
                          name="altText"
                          required
                          placeholder="Alt text (required)"
                          className="w-full rounded border border-lightblue px-2 py-1 text-[0.65rem] outline-none focus:border-blue"
                        />
                        <button className="rounded bg-blue px-2 py-1 text-[0.65rem] font-semibold text-white">
                          Add
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-1 text-[0.65rem] text-orange">Missing</p>
                  )}
                </li>
              ))}
              <li className="border-t border-paper pt-2">
                <p className="flex items-center gap-2">
                  <span className={infographic ? "text-blue" : "text-ink/40"} aria-hidden>
                    {infographic ? "✓" : "○"}
                  </span>
                  <span className="font-semibold uppercase tracking-wide text-ink/70">Infographic</span>
                  {infographicDue && !infographic && (
                    <span className="rounded-full border border-yellow bg-yellow/20 px-2 py-0.5 text-[0.6rem] text-ink">
                      due — every 3rd article
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={`/w/${slug}/content/${article.id}/infographic.svg`}
                    target="_blank"
                    className="text-[0.65rem] text-blue underline"
                  >
                    Preview brand SVG
                  </a>
                  {canEdit && !infographic && (
                    <form action={attachInfographic}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="articleId" value={article.id} />
                      <button className="rounded bg-blue px-2 py-1 text-[0.65rem] font-semibold text-white">
                        Attach to article
                      </button>
                    </form>
                  )}
                </div>
              </li>
            </ul>
          </section>

          <section className="rounded-brand border border-lightblue bg-white p-4">
            <h2 className="mb-2 font-display text-sm font-semibold text-ink">Workflow</h2>
            {targets.length === 0 ? (
              <p className="text-xs text-ink/50">No transitions from this state here yet.</p>
            ) : (
              <div className="space-y-2">
                {targets.map((t) => (
                  <form key={t} action={transitionArticle}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={article.id} />
                    <input type="hidden" name="target" value={t} />
                    <button
                      className={
                        "w-full rounded-lg px-3 py-2 text-left font-display text-xs font-semibold " +
                        (t === "scheduled" || t === "published"
                          ? "bg-orange text-white"
                          : t === "drafting"
                            ? "border border-lightblue bg-white text-ink/70"
                            : "bg-blue text-white")
                      }
                    >
                      {TARGET_LABELS[t]}
                    </button>
                  </form>
                ))}
                {unverified.length > 0 && (
                  <p className="text-[0.65rem] text-orange">
                    ⚠ Scheduling/publishing is blocked while {unverified.length} claim(s)
                    lack a verified source.
                  </p>
                )}
              </div>
            )}
          </section>

          {article.state === "scheduled" && (
            <section className="rounded-brand border-2 border-orange bg-white p-4">
              <h2 className="mb-2 font-display text-sm font-semibold text-ink">
                Publish to WordPress
              </h2>
              {data.wpConnection?.status === "connected" ? (
                <>
                  <details className="mb-2 rounded-lg border border-lightblue bg-paper p-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-blue">
                      Dry run — exactly what will be sent
                    </summary>
                    <dl className="mt-2 space-y-1 text-[0.7rem] text-ink/80">
                      <div><dt className="inline font-semibold">Site: </dt><dd className="inline">{String((data.wpConnection.config as Record<string, unknown>)?.siteUrl ?? "")}</dd></div>
                      <div><dt className="inline font-semibold">Title: </dt><dd className="inline">{article.title}</dd></div>
                      <div><dt className="inline font-semibold">Slug: </dt><dd className="inline">{seo?.slug}</dd></div>
                      <div><dt className="inline font-semibold">Excerpt: </dt><dd className="inline">{seo?.meta}</dd></div>
                      <div><dt className="inline font-semibold">Featured: </dt><dd className="inline break-all">{featured?.url} (alt: {featured?.altText})</dd></div>
                      <div><dt className="inline font-semibold">Infographic: </dt><dd className="inline">{infographic ? "embedded as figure" : "none"}</dd></div>
                      <div><dt className="inline font-semibold">Status: </dt><dd className="inline">publish</dd></div>
                    </dl>
                  </details>
                  {can(role, "content.approve_final") ? (
                    <form action={publishToWordPress}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={article.id} />
                      <button className="w-full rounded-lg bg-orange px-3 py-2 font-display text-sm font-semibold text-white">
                        🚀 Publish now
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-ink/60">Awaiting a final approver to publish.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-orange">
                  No connected WordPress site — connect one in Settings → Integrations.
                </p>
              )}
            </section>
          )}

          {article.state === "published" && article.publishedUrl && (
            <section className="rounded-brand border border-yellow bg-yellow/10 p-4">
              <h2 className="mb-1 font-display text-sm font-semibold text-ink">Live</h2>
              <a href={article.publishedUrl} target="_blank" className="break-all text-xs text-blue underline">
                {article.publishedUrl}
              </a>
            </section>
          )}

          {article.versions.length > 0 && (
            <section className="rounded-brand border border-lightblue bg-white p-4">
              <h2 className="mb-2 font-display text-sm font-semibold text-ink">Versions</h2>
              <ul className="space-y-1 text-xs text-ink/60">
                {article.versions.map((v) => (
                  <li key={v.id}>
                    v{v.version} · {new Date(v.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
