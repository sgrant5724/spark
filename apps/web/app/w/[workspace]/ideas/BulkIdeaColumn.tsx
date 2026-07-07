"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, FileText, type LucideIcon, X } from "lucide-react";
import { useToast, Button } from "@/components/ui";
import { bulkIdeaAction, sendToDraft, setIdeaStatus } from "./actions";

export type BoardIdea = {
  id: string;
  title: string;
  tier: number | null;
  audience: string | null;
  source: string;
  suggestedMotifs: Record<string, number> | null;
};

/** Server-side bulk kinds handled by bulkIdeaAction. */
type BulkKind = "approve" | "send_to_draft" | "reject";
/** Single-card quick actions. */
type QuickKind = "approve" | "draft" | "reject";

const BULK_DEFS: Record<
  BulkKind,
  { label: string; verb: string; variant: "secondary" | "ghost" | "danger"; Icon: LucideIcon }
> = {
  approve: { label: "Approve", verb: "Approved", variant: "secondary", Icon: CheckCheck },
  send_to_draft: { label: "Draft", verb: "Drafting", variant: "ghost", Icon: FileText },
  reject: { label: "Reject", verb: "Rejected", variant: "danger", Icon: X },
};

/**
 * A kanban column of ideas with multi-select bulk actions (Approve / Draft /
 * Reject over the whole selection via bulkIdeaAction, permission-checked
 * server-side) plus per-card quick actions. Used for the Discovered and
 * Approved columns with different action sets.
 */
export function BulkIdeaColumn({
  slug,
  ideas,
  bulk,
  quick,
}: {
  slug: string;
  ideas: BoardIdea[];
  bulk: BulkKind[];
  quick: QuickKind[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = ideas.length > 0 && selected.size === ideas.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(ideas.map((i) => i.id)));

  async function runBulk(kind: BulkKind) {
    const ids = [...selected];
    if (!ids.length) return;
    const { verb } = BULK_DEFS[kind];
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("action", kind);
    ids.forEach((id) => fd.append("ids", id));
    toast({ tone: "info", title: `${verb} ${ids.length}…`, description: "Working on it." });
    try {
      await bulkIdeaAction(fd);
      toast({ tone: "success", title: `${verb} ${ids.length} idea(s)` });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast({
        tone: "error",
        title: `${verb} failed`,
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

  if (ideas.length === 0) {
    return <p className="px-1 py-3 text-center text-xs text-ink/40">Empty</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <label className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink/50">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5 accent-blue"
            aria-label="Select all ideas in this column"
          />
          Select all
        </label>
        {selected.size > 0 && (
          <span className="font-mono text-[0.6rem] tabular-nums text-blue">{selected.size} selected</span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap gap-1.5 rounded-lg border border-blue/30 bg-white p-2 shadow-md">
          {bulk.map((kind) => {
            const def = BULK_DEFS[kind];
            return (
              <Button
                key={kind}
                size="sm"
                variant={def.variant}
                onClick={() => runBulk(kind)}
                leftIcon={<def.Icon className="h-3.5 w-3.5" aria-hidden />}
              >
                {def.label}
              </Button>
            );
          })}
        </div>
      )}

      {ideas.map((idea) => {
        const isSel = selected.has(idea.id);
        return (
          <article
            key={idea.id}
            className={
              "rounded-lg border bg-white p-3 transition-colors " +
              (isSel ? "border-blue ring-1 ring-blue/30" : "border-lightblue")
            }
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(idea.id)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue"
                aria-label={`Select ${idea.title}`}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-snug text-ink">{idea.title}</h3>
                <div className="mt-1 flex flex-wrap gap-1 text-[0.6rem] text-ink/50">
                  {idea.tier && <span className="rounded bg-paper px-1.5 py-0.5">T{idea.tier}</span>}
                  {idea.audience && <span className="rounded bg-paper px-1.5 py-0.5">{idea.audience}</span>}
                  <span className="rounded bg-paper px-1.5 py-0.5">{idea.source}</span>
                </div>
                {idea.suggestedMotifs && Object.keys(idea.suggestedMotifs).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.keys(idea.suggestedMotifs).map((k) => (
                      <span key={k} className="rounded-full border border-lightblue bg-paper px-2 py-0.5 text-[0.6rem] text-blue">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                {quick.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-paper pt-2">
                    {quick.includes("approve") && (
                      <form action={setIdeaStatus}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={idea.id} />
                        <input type="hidden" name="status" value="approved" />
                        <button className="text-xs font-semibold text-blue underline" title="Approve for the auto-draft queue">
                          Approve
                        </button>
                      </form>
                    )}
                    {quick.includes("draft") && (
                      <form action={sendToDraft}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={idea.id} />
                        <button className="text-xs font-semibold text-blue underline">Draft now</button>
                      </form>
                    )}
                    {quick.includes("reject") && (
                      <form action={setIdeaStatus}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={idea.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button className="text-xs text-orange underline">Reject</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
