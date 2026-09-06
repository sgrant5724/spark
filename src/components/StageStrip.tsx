"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAGES, currentTab, stageFor } from "@/lib/stages";

/**
 * The persistent stage strip — mounted once in the app shell, so every page a
 * stage owns shows the same bar: the stage's Overview, then its tabs, with the
 * current one lit. It is what makes "click a tab, keep the tabs" true; before,
 * the tabs lived on the overview page only and each module page brought its
 * own unrelated bar (the owner: "I'm either lost with no way back or taken to
 * a completely different navigation").
 *
 * Renders nothing outside a stage (Inbox, Assistant, Setup, Help). Client-side
 * purely for usePathname; the stage data itself is plain and shared.
 */
export function StageStrip({ activeChannelId, studio }: { activeChannelId: string | null; studio: boolean }) {
  const pathname = usePathname() ?? "";
  const key = stageFor(pathname);
  if (!key) return null;
  const stage = STAGES[key];
  const tabs = stage.tabs({ channelId: activeChannelId, studio });
  const onOverview = pathname === stage.href;
  const current = onOverview ? null : currentTab(pathname, tabs);

  return (
    <nav
      aria-label={`${stage.label} pages`}
      className="sticky top-0 z-30 -mx-6 -mt-6 mb-5 px-6 flex items-center gap-1 flex-wrap border-b border-[var(--line)] bg-[var(--panel)]"
    >
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--mute)] pr-2 py-2">{stage.label}</span>
      <Link
        href={stage.href}
        aria-current={onOverview ? "page" : undefined}
        className="text-[11px] font-semibold px-2.5 py-2 border-b-2 -mb-px transition-colors"
        style={onOverview ? { borderColor: "var(--accent)", color: "var(--accent-on)" } : { borderColor: "transparent", color: "var(--mute)" }}
      >
        Overview
      </Link>
      {tabs.map((t) => {
        const on = current?.href === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className="text-[11px] font-semibold px-2.5 py-2 border-b-2 -mb-px transition-colors hover:text-[var(--ink)]"
            style={on ? { borderColor: "var(--accent)", color: "var(--accent-on)" } : { borderColor: "transparent", color: "var(--mute)" }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
