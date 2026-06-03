import { KeywordIntent, PageType, withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import {
  createKeyword,
  deleteKeyword,
  createPage,
  deletePage,
  createLink,
  deleteLink,
} from "./actions";

const inputCls =
  "w-full rounded-lg border border-lightblue px-2.5 py-1.5 text-sm text-ink outline-none focus:border-blue";
const thCls = "px-3 py-2 text-left font-display text-xs font-semibold text-white";
const tdCls = "px-3 py-2 align-top";

export default async function StrategyPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const workspaceId = membership.workspaceId;
  const canManage = can(membership.role, "strategy.manage");

  const data = await withWorkspace(db, workspaceId, async (tx) => {
    const keywords = await tx.keyword.findMany({
      where: { workspaceId },
      orderBy: [{ tier: "asc" }, { phrase: "asc" }],
    });
    const pages = await tx.page.findMany({
      where: { workspaceId },
      orderBy: { url: "asc" },
    });
    const links = await tx.pageLink.findMany({ where: { workspaceId } });
    return { keywords, pages, links };
  });

  const pageUrl = new Map(data.pages.map((p) => [p.id, p.url]));

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Strategy</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        The four-tier keyword model, page inventory, and internal-link graph as
        living data (FR-4). Volume &amp; difficulty come only from real research
        integrations — never entered by hand.
      </p>

      {/* ---- Keywords ---- */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Keywords ({data.keywords.length})
        </h2>
        <div className="overflow-hidden rounded-brand border border-lightblue">
          <table className="w-full bg-white text-sm">
            <thead className="bg-ink">
              <tr>
                <th className={thCls}>Tier</th>
                <th className={thCls}>Phrase</th>
                <th className={thCls}>Service</th>
                <th className={thCls}>Audience</th>
                <th className={thCls}>Intent</th>
                <th className={thCls}>Target page</th>
                <th className={thCls}>Vol</th>
                <th className={thCls}>Diff</th>
                {canManage && <th className={thCls}></th>}
              </tr>
            </thead>
            <tbody>
              {data.keywords.map((k) => (
                <tr key={k.id} className="border-t border-paper">
                  <td className={tdCls}>T{k.tier}</td>
                  <td className={tdCls + " font-medium text-ink"}>{k.phrase}</td>
                  <td className={tdCls}>{k.service ?? "—"}</td>
                  <td className={tdCls}>{k.audience ?? "—"}</td>
                  <td className={tdCls}>{k.intent ?? "—"}</td>
                  <td className={tdCls}>
                    {k.targetPageId ? pageUrl.get(k.targetPageId) ?? "—" : "—"}
                  </td>
                  <td className={tdCls}>{k.volume ?? "—"}</td>
                  <td className={tdCls}>{k.difficulty ?? "—"}</td>
                  {canManage && (
                    <td className={tdCls}>
                      <form action={deleteKeyword}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={k.id} />
                        <button className="text-xs text-orange underline">delete</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
              {data.keywords.length === 0 && (
                <tr>
                  <td className={tdCls + " text-ink/50"} colSpan={canManage ? 9 : 8}>
                    No keywords yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form
            action={createKeyword}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-lightblue bg-white p-3"
          >
            <input type="hidden" name="slug" value={slug} />
            <select name="tier" defaultValue="4" className={inputCls + " w-16"} aria-label="Tier">
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>T{t}</option>
              ))}
            </select>
            <input name="phrase" required placeholder="phrase *" className={inputCls + " w-56"} />
            <input name="service" placeholder="service" className={inputCls + " w-32"} />
            <input name="audience" placeholder="audience" className={inputCls + " w-32"} />
            <select name="intent" defaultValue="" className={inputCls + " w-36"} aria-label="Intent">
              <option value="">intent…</option>
              {Object.values(KeywordIntent).map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <select name="targetPageId" defaultValue="" className={inputCls + " w-44"} aria-label="Target page">
              <option value="">no target page</option>
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>{p.url}</option>
              ))}
            </select>
            <button className="rounded-lg bg-orange px-3 py-1.5 font-display text-sm font-semibold text-white">
              Add keyword
            </button>
          </form>
        )}
      </section>

      {/* ---- Pages ---- */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Pages ({data.pages.length})
        </h2>
        <div className="overflow-hidden rounded-brand border border-lightblue">
          <table className="w-full bg-white text-sm">
            <thead className="bg-ink">
              <tr>
                <th className={thCls}>URL</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Primary keyword</th>
                {canManage && <th className={thCls}></th>}
              </tr>
            </thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.id} className="border-t border-paper">
                  <td className={tdCls + " font-medium text-ink"}>{p.url}</td>
                  <td className={tdCls}>{p.pageType}</td>
                  <td className={tdCls}>{p.primaryKeyword ?? "—"}</td>
                  {canManage && (
                    <td className={tdCls}>
                      <form action={deletePage}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-xs text-orange underline">delete</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
              {data.pages.length === 0 && (
                <tr>
                  <td className={tdCls + " text-ink/50"} colSpan={canManage ? 4 : 3}>
                    No pages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form
            action={createPage}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-lightblue bg-white p-3"
          >
            <input type="hidden" name="slug" value={slug} />
            <input name="url" required placeholder="/url-path/ *" className={inputCls + " w-56"} />
            <select name="pageType" defaultValue={PageType.blog} className={inputCls + " w-44"} aria-label="Page type">
              {Object.values(PageType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input name="primaryKeyword" placeholder="primary keyword" className={inputCls + " w-48"} />
            <button className="rounded-lg bg-orange px-3 py-1.5 font-display text-sm font-semibold text-white">
              Add page
            </button>
          </form>
        )}
      </section>

      {/* ---- Internal-link graph ---- */}
      <section>
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Internal-link graph ({data.links.length})
        </h2>
        {data.links.length === 0 ? (
          <p className="text-sm text-ink/60">No link edges yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.links.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-lightblue bg-white px-3 py-2 text-sm"
              >
                <span className="text-ink">
                  {pageUrl.get(l.fromPageId) ?? "?"}{" "}
                  <span className="text-blue">→</span>{" "}
                  {pageUrl.get(l.toPageId) ?? "?"}
                  {l.anchorText && (
                    <span className="text-ink/50"> · &ldquo;{l.anchorText}&rdquo;</span>
                  )}
                </span>
                {canManage && (
                  <form action={deleteLink}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs text-orange underline">delete</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && data.pages.length >= 2 && (
          <form
            action={createLink}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-lightblue bg-white p-3"
          >
            <input type="hidden" name="slug" value={slug} />
            <select name="fromPageId" className={inputCls + " w-48"} aria-label="From page">
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>{p.url}</option>
              ))}
            </select>
            <span className="text-blue">→</span>
            <select name="toPageId" className={inputCls + " w-48"} aria-label="To page">
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>{p.url}</option>
              ))}
            </select>
            <input name="anchorText" placeholder="anchor text" className={inputCls + " w-44"} />
            <button className="rounded-lg bg-orange px-3 py-1.5 font-display text-sm font-semibold text-white">
              Add link
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
