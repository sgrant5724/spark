"use client";

// Opens the ⌘K command palette. Sits in the workspace sidebar as the fast path
// to search articles/ideas or jump to any section.
export function SearchTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("spark:open-cmdk"))}
      className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
      aria-label="Open command palette"
    >
      <span className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Search
      </span>
      <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-[0.6rem] font-semibold">⌘K</kbd>
    </button>
  );
}
