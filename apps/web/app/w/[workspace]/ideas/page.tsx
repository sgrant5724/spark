import { Sparkles, Zap } from "lucide-react";
import { IdeaStatus, withWorkspace } from "@spark/db";
import { can } from "@spark/shared";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { Button } from "@/components/ui";
import { DiscoveredIdeas } from "./discovered";
import { createIdea, discoverIdeas, runPipeline, setIdeaStatus, sendToDraft } from "./actions";

const COLUMNS: Array<{ status: IdeaStatus; title: string }> = [
  { status: IdeaStatus.discovered, title: "Discovered" },
  { status: IdeaStatus.approved, title: "Approved" },
  { status: IdeaStatus.refresh, title: "Refresh" },
  { status: IdeaStatus.rejected, title: "Rejected" },
];

const inputCls =
  "rounded-lg border border-lightblue px-2.5 py-1.5 text-sm text-ink outline-none focus:border-blue";

function MotifChips({ mix }: { mix: unknown }) {
  const entries = Object.entries((mix as Record<string, number>) ?? {});
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([k]) => (
        <span
          key={k}
          className="rounded-full border border-lightblue bg-paper px-2 py-0.5 text-[0.6rem] text-blue"
        >
          {k}
        </span>
      ))}
    </div>
  );
}

export default async function IdeasPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const canManage = can(membership.role, "strategy.manage");

  const ideas = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.idea.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  );

  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Idea Engine</h1>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <form action={runPipeline}>
              <input type="hidden" name="slug" value={slug} />
              <Button
                type="submit"
                variant="secondary"
                leftIcon={<Zap className="h-4 w-4" aria-hidden />}
                title="Auto-draft up to 2 approved ideas and park them at draft review"
              >
                Auto-draft approved
              </Button>
            </form>
            <form action={discoverIdeas}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" leftIcon={<Sparkles className="h-4 w-4" aria-hidden />}>
                Discover ideas (AI)
              </Button>
            </form>
          </div>
        )}
      </header>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Topic ideas grounded in this workspace&apos;s organization profile and
        keyword strategy (FR-5). AI suggestions carry no invented metrics —
        validate before committing.
      </p>

      {canManage && (
        <form
          action={createIdea}
          className="mb-6 flex flex-wrap items-end gap-2 rounded-brand border border-lightblue bg-white p-3"
        >
          <input type="hidden" name="slug" value={slug} />
          <input name="title" required placeholder="Add an idea manually…" className={inputCls + " w-72"} />
          <select name="tier" defaultValue="" className={inputCls} aria-label="Tier">
            <option value="">tier…</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>T{t}</option>
            ))}
          </select>
          <input name="audience" placeholder="audience" className={inputCls + " w-36"} />
          <button className="rounded-lg bg-blue px-3 py-1.5 font-display text-sm font-semibold text-white">
            Add
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = ideas.filter((i) => i.status === col.status);
          return (
            <section
              key={col.status}
              className="rounded-brand border border-lightblue bg-paper p-3"
              aria-label={col.title}
            >
              <h2 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/60">
                {col.title} <span>{items.length}</span>
              </h2>
              {col.status === IdeaStatus.discovered && canManage ? (
                <DiscoveredIdeas
                  slug={slug}
                  ideas={items.map((i) => ({
                    id: i.id,
                    title: i.title,
                    tier: i.tier,
                    audience: i.audience,
                    source: i.source,
                    suggestedMotifs: (i.suggestedMotifs as Record<string, number>) ?? null,
                  }))}
                />
              ) : (
              <div className="space-y-2">
                {items.map((idea) => (
                  <article
                    key={idea.id}
                    className="rounded-lg border border-lightblue bg-white p-3"
                  >
                    <h3 className="text-sm font-semibold leading-snug text-ink">
                      {idea.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-1 text-[0.6rem] text-ink/50">
                      {idea.tier && <span className="rounded bg-paper px-1.5 py-0.5">T{idea.tier}</span>}
                      {idea.audience && <span className="rounded bg-paper px-1.5 py-0.5">{idea.audience}</span>}
                      <span className="rounded bg-paper px-1.5 py-0.5">{idea.source}</span>
                    </div>
                    <MotifChips mix={idea.suggestedMotifs} />
                    {canManage && (
                      <div className="mt-2 flex flex-wrap gap-2 border-t border-paper pt-2">
                        {idea.status === IdeaStatus.discovered && (
                          <>
                            <form action={setIdeaStatus}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={idea.id} />
                              <input type="hidden" name="status" value="approved" />
                              <button
                                className="text-xs font-semibold text-blue underline"
                                title="Approve for the auto-draft queue"
                              >
                                Approve
                              </button>
                            </form>
                            <form action={sendToDraft}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={idea.id} />
                              <button className="text-xs font-semibold text-blue underline">
                                Draft now
                              </button>
                            </form>
                            <form action={setIdeaStatus}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="id" value={idea.id} />
                              <input type="hidden" name="status" value="rejected" />
                              <button className="text-xs text-orange underline">Reject</button>
                            </form>
                          </>
                        )}
                        {idea.status === IdeaStatus.rejected && (
                          <form action={setIdeaStatus}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={idea.id} />
                            <input type="hidden" name="status" value="discovered" />
                            <button className="text-xs text-blue underline">Restore</button>
                          </form>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-ink/40">Empty</p>
                )}
              </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
