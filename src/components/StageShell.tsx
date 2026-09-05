import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { sendAssistantMessageAction } from "@/app/actions/assistant";

/**
 * The stage-page skeleton (One-Loop redesign, step 3). Every stage shares it
 * so learning one teaches all seven: a header with counts by state, a tab
 * strip of the module pages that live inside the stage (their URLs are
 * unchanged — this is a re-grouping, not a re-routing), the stage's own item
 * rows, and the Ask drawer.
 *
 * Ask is a plain form into the assistant: a message with no thread id starts
 * one and lands on its transcript. It reads and drafts; it cannot publish,
 * send, schedule, approve or delete — the allowlist in lib/assistant/tools.ts
 * is the safety model, and a docked box on every stage doesn't change it.
 */

export type StageTab = { href: string; label: string; note?: string };
export type StageCount = { label: string; n: number | null; href?: string; hue?: string };

export function StageHeader({
  title,
  sentence,
  counts,
  tabs,
}: {
  title: string;
  sentence: string;
  counts: StageCount[];
  tabs: StageTab[];
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-mono text-[22px] font-bold m-0">{title}</h1>
        <p className="text-[13px] text-[var(--mute)] m-0">{sentence}</p>
      </div>
      {counts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {counts.map((c) => {
            const hue = c.hue ?? "zebra";
            const chip = (
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded-full"
                style={hue === "zebra" ? { background: "var(--zebra)", color: "var(--mute)" } : { background: `var(--${hue}-soft)`, color: `var(--${hue}-on)` }}
                title={c.n === null ? "not measured" : undefined}
              >
                <b className="tabular-nums">{c.n === null ? "—" : c.n}</b> {c.label}
              </span>
            );
            return c.href ? <Link key={c.label} href={c.href} className="hover:underline">{chip}</Link> : <span key={c.label}>{chip}</span>;
          })}
        </div>
      )}
      {tabs.length > 0 && (
        <nav className="flex items-center gap-1 flex-wrap mt-3 border-b border-[var(--line)]" aria-label="Pages in this stage">
          <span className="text-[11px] font-semibold px-2.5 py-1.5 border-b-2 border-[var(--accent)] -mb-px" style={{ color: "var(--accent-on)" }}>Overview</span>
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} title={t.note} className="text-[11px] font-semibold px-2.5 py-1.5 text-[var(--mute)] hover:text-[var(--ink)] border-b-2 border-transparent -mb-px">
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** A row of items in a stage. Only rendered when non-empty by the caller. */
export function StageList({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: string }) {
  return (
    <section className="card mb-4">
      <h2 className="font-mono text-[13px] font-bold mb-2">{title}</h2>
      {children ? <ul className="m-0 p-0 flex flex-col">{children}</ul> : <p className="text-xs text-[var(--mute)] m-0">{empty}</p>}
    </section>
  );
}

export function StageRow({ children }: { children: React.ReactNode }) {
  return <li className="border-t border-[var(--line)] first:border-t-0 py-2.5 flex items-center gap-3 flex-wrap">{children}</li>;
}

export function StateChip({ label, hue }: { label: string; hue: string }) {
  return (
    <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: `var(--${hue}-soft)`, color: `var(--${hue}-on)` }}>
      {label}
    </span>
  );
}

export function AskDrawer({ stage, placeholder }: { stage: string; placeholder: string }) {
  return (
    <section className="card mt-2" style={{ borderStyle: "dashed" }}>
      <h2 className="font-mono text-[13px] font-bold mb-1 flex items-center gap-1.5">
        <MessageCircle className="w-4 h-4" style={{ color: "var(--violet-on)" }} /> Ask
      </h2>
      <p className="text-[11px] text-[var(--mute)] mb-2 mt-0">
        The assistant reads this workspace and can draft — it can&apos;t publish, send, schedule, approve or delete. The answer opens as a thread you can keep.
      </p>
      <form action={sendAssistantMessageAction} className="flex flex-col gap-2">
        <textarea name="message" rows={2} required maxLength={4000} placeholder={placeholder} className="w-full text-sm" aria-label={`Ask about ${stage}`} />
        <div className="flex items-center gap-2">
          <SubmitButton className="btn sm primary" pendingText="Working…">Ask</SubmitButton>
          <span className="text-[10px] text-[var(--mute)]">May run several steps — don&apos;t reload.</span>
        </div>
      </form>
    </section>
  );
}
