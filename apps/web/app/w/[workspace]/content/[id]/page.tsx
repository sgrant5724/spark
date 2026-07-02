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
  generateDraft,
  generateSeo,
  saveArticle,
  verifyCitation,
  transitionArticle,
} from "../actions";
import { runA11yChecks } from "@/lib/checks";

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
}: {
  params: { workspace: string; id: string };
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
      },
    });
    const smeProfiles = await tx.smeProfile.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return { article, smeProfiles };
  });
  if (!data.article) notFound();
  const article = data.article;

  const unverified = article.citations.filter((c) => !c.verified);
  const a11y = runA11yChecks(article.body, article.title);
  const seo = article.seoOutput;
  const targets = (ARTICLE_TRANSITIONS[article.state as ArticleStateName] ?? []).filter(
    (t) => TARGET_LABELS[t],
  );
  const motifMix = (article.motifMix as Record<string, number>) ?? {};

  return (
    <div className="px-8 py-8">
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
              </dl>
            )}
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
