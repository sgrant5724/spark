import { KeywordIntent, PageType, withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { Widget } from "@/components/widgets";
import { Donut } from "@/components/ui";
import { CATEGORICAL } from "@/lib/viz";
import {
  createKeyword,
  deleteKeyword,
  createPage,
  deletePage,
  createLink,
  deleteLink,
} from "./actions";

const TIER_COLORS = ["#0A3A56", "#0D5A84", "#2E7BA6", "#6FA8C4"];

const inputCls =
  "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";
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

  // Distribution summaries (real counts from the keyword table).
  const tierSegments = [1, 2, 3, 4].map((t, i) => ({
    label: `Tier ${t}`,
    value: data.keywords.filter((k) => k.tier === t).length,
    color: TIER_COLORS[i],
  }));
  const intentMap = new Map<string, number>();
  for (const k of data.keywords) {
    const key = k.intent ?? "unset";
    intentMap.set(key, (intentMap.get(key) ?? 0) + 1);
  }
  const intentSegments = [...intentMap.entries()].map(([label, value], i) => ({
    label,
    value,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));
  const maxTier = Math.max(...tierSegments.map((s) => s.value), 1);

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Strategy</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        The four-tier keyword model, page inventory, and internal-link graph as
        living data (FR-4). Volume &amp; difficulty come only from real research
        integrations — never entered by hand.
      </p>

      {/* ---- Distribution summary ---- */}
      {data.keywords.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Widget title="Keywords by tier">
            <div className="flex flex-col gap-2">
              {tierSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span className="w-14 shrink-0 text-[0.65rem] uppercase tracking-wide text-ink/50">
                    {s.label}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-paper2">
                    <div
                      className="h-full rounded"
                      style={{ width: `${s.value ? Math.max((s.value / maxTier) * 100, 6) : 0}%`, background: s.color }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-ink">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </Widget>
          <Widget title="Intent distribution">
            <Donut segments={intentSegments} centerLabel={String(data.keywords.length)} />
          </Widget>
        </div>
      )}

      {/* ---- Keywords ---- */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold text-ink">
          Keywords ({data.keywords.length})
        </h2>
        <div className="overflow-hidden rounded-brand border border-line">
          <table className="w-full bg-surface text-sm">
            <thead className="bg-gradient-to-r from-nav to-blue">
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
                        <button className="text-xs text-accent-warn underline">delete</button>
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
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-line bg-surface p-3"
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
        <div className="overflow-hidden rounded-brand border border-line">
          <table className="w-full bg-surface text-sm">
            <thead className="bg-gradient-to-r from-nav to-blue">
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
                        <button className="text-xs text-accent-warn underline">delete</button>
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
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-line bg-surface p-3"
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
          <>
            <div className="mb-3 overflow-x-auto rounded-brand border border-line bg-surface p-3">
              <LinkArcDiagram
                pages={data.pages.map((p) => ({ id: p.id, url: p.url }))}
                links={data.links.map((l) => ({ from: l.fromPageId, to: l.toPageId }))}
              />
            </div>
            <ul className="space-y-2">
            {data.links.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <span className="text-ink">
                  {pageUrl.get(l.fromPageId) ?? "?"}{" "}
                  <span className="text-accent">→</span>{" "}
                  {pageUrl.get(l.toPageId) ?? "?"}
                  {l.anchorText && (
                    <span className="text-ink/50"> · &ldquo;{l.anchorText}&rdquo;</span>
                  )}
                </span>
                {canManage && (
                  <form action={deleteLink}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs text-accent-warn underline">delete</button>
                  </form>
                )}
              </li>
            ))}
            </ul>
          </>
        )}

        {canManage && data.pages.length >= 2 && (
          <form
            action={createLink}
            className="mt-3 flex flex-wrap items-end gap-2 rounded-brand border border-line bg-surface p-3"
          >
            <input type="hidden" name="slug" value={slug} />
            <select name="fromPageId" className={inputCls + " w-48"} aria-label="From page">
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>{p.url}</option>
              ))}
            </select>
            <span className="text-accent">→</span>
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

/**
 * Internal-link arc diagram (SVG). Pages sit on a horizontal axis; each link is
 * a semicircular arc from source to target. Only pages that participate in a
 * link are plotted, so the graph stays legible. Accessible via role="img".
 */
function LinkArcDiagram({
  pages,
  links,
}: {
  pages: Array<{ id: string; url: string }>;
  links: Array<{ from: string; to: string }>;
}) {
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  const nodes = pages.filter((p) => linked.has(p.id));
  if (nodes.length < 2) return null;

  const W = Math.max(360, nodes.length * 110);
  const H = 150;
  const pad = 40;
  const axisY = H - 34;
  const step = (W - pad * 2) / Math.max(nodes.length - 1, 1);
  const x = (id: string) => {
    const i = nodes.findIndex((n) => n.id === id);
    return pad + i * step;
  };
  const short = (url: string) => (url.length > 14 ? url.slice(0, 13) + "…" : url);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Internal link graph: ${nodes.length} pages, ${links.length} links`}
    >
      {/* arcs */}
      {links.map((l, i) => {
        const x1 = x(l.from);
        const x2 = x(l.to);
        if (x1 == null || x2 == null || x1 === x2) return null;
        const r = Math.abs(x2 - x1) / 2;
        const sweep = x2 > x1 ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${x1} ${axisY} A ${r} ${r} 0 0 ${sweep} ${x2} ${axisY}`}
            fill="none"
            stroke="#1A7AAB"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
        );
      })}
      {/* nodes */}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={x(n.id)} cy={axisY} r="4.5" fill="#0D5A84" />
          <text
            x={x(n.id)}
            y={axisY + 18}
            textAnchor="middle"
            fontSize="9"
            fill="#343433"
            fillOpacity="0.7"
            fontFamily="'JetBrains Mono', monospace"
          >
            {short(n.url)}
          </text>
        </g>
      ))}
    </svg>
  );
}
