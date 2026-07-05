"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Cmd = { id: string; label: string; hint?: string; href: string };

const NAV_LABELS: Array<[string, string]> = [
  ["Mission Control", ""],
  ["Organization", "/organization"],
  ["SME Profiles", "/sme"],
  ["Strategy", "/strategy"],
  ["Ideas", "/ideas"],
  ["Content", "/content"],
  ["Workflow", "/workflow"],
  ["Calendar", "/calendar"],
  ["Social", "/social"],
  ["Analytics", "/analytics"],
  ["Members", "/members"],
  ["Settings", "/settings"],
];

export function CommandPalette({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<{
    articles: { id: string; title: string; state: string }[];
    ideas: { id: string; title: string; status: string }[];
  }>({ articles: [], ideas: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl-K to toggle; a custom event lets buttons open it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("spark:open-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("spark:open-cmdk", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setRemote({ articles: [], ideas: [] });
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Debounced tenant search.
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setRemote({ articles: [], ideas: [] });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/w/${slug}/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setRemote(await res.json());
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open, slug]);

  const navMatches: Cmd[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    return NAV_LABELS.filter(([label]) => !query || label.toLowerCase().includes(query)).map(
      ([label, path]) => ({ id: `nav-${path}`, label, hint: "Go to", href: `/w/${slug}${path}` }),
    );
  }, [q, slug]);

  const items: Cmd[] = useMemo(
    () => [
      ...navMatches,
      ...remote.articles.map((a) => ({
        id: `a-${a.id}`,
        label: a.title,
        hint: `Article · ${a.state.replace(/_/g, " ")}`,
        href: `/w/${slug}/content/${a.id}`,
      })),
      ...remote.ideas.map((i) => ({
        id: `i-${i.id}`,
        label: i.title,
        hint: `Idea · ${i.status}`,
        href: `/w/${slug}/ideas`,
      })),
    ],
    [navMatches, remote, slug],
  );

  const go = useCallback(
    (cmd?: Cmd) => {
      const target = cmd ?? items[active];
      if (!target) return;
      setOpen(false);
      router.push(target.href);
    },
    [items, active, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-nav2/50 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-brand border border-lightblue bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search articles, ideas, or jump to a section…"
          aria-label="Search"
          className="w-full border-b border-paper px-4 py-3.5 text-sm text-ink outline-none"
        />
        <ul className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink/40">No matches.</li>
          ) : (
            items.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(cmd)}
                  className={
                    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm " +
                    (i === active ? "bg-paper text-ink" : "text-ink/80")
                  }
                >
                  <span className="truncate">{cmd.label}</span>
                  {cmd.hint && <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-ink/40">{cmd.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-paper px-4 py-2 text-[0.62rem] text-ink/40">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>Spark ⌘K</span>
        </div>
      </div>
    </div>
  );
}
