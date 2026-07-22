"use client";

import { useEffect, useRef, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";

/**
 * Appearance popover: theme + font-size picker. The active values are applied by
 * a no-flash inline script (root layout) that sets [data-theme]/[data-font]
 * before paint; this control reads them on mount, then updates the attributes
 * and persists the choice. Theme/font ids must stay in sync with globals.css
 * and the no-flash script. Styled for the always-dark app headers.
 */

type ThemeId = "light" | "dark" | "midnight" | "slate" | "sepia" | "contrast";

const THEMES: Array<{
  id: ThemeId;
  label: string;
  hint: string;
  swatch: [string, string, string]; // canvas, surface, accent
}> = [
  { id: "light", label: "Light", hint: "Brand default", swatch: ["#EFF3FA", "#FFFFFF", "#0D5A84"] },
  { id: "dark", label: "Dark", hint: "Deep instrument", swatch: ["#06141E", "#0F2739", "#7BB8DE"] },
  { id: "midnight", label: "Midnight", hint: "Indigo night", swatch: ["#080B16", "#14192C", "#8AAAFF"] },
  { id: "slate", label: "Slate", hint: "Calm neutral", swatch: ["#E9EBEF", "#FFFFFF", "#0D5A84"] },
  { id: "sepia", label: "Sepia", hint: "Warm paper", swatch: ["#F4ECE0", "#FDF8F0", "#115270"] },
  { id: "contrast", label: "High contrast", hint: "Max legibility", swatch: ["#000000", "#0F0F12", "#7DC8FF"] },
];

type FontId = "sm" | "base" | "lg" | "xl";
const FONTS: Array<{ id: FontId; label: string; px: string; glyph: string }> = [
  { id: "sm", label: "Compact", px: "14px", glyph: "text-[0.7rem]" },
  { id: "base", label: "Default", px: "16px", glyph: "text-sm" },
  { id: "lg", label: "Large", px: "18px", glyph: "text-base" },
  { id: "xl", label: "X-Large", px: "20px", glyph: "text-lg" },
];

export function AppearancePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("light");
  const [font, setFont] = useState<FontId>("base");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = document.documentElement;
    const t = d.getAttribute("data-theme") as ThemeId | null;
    const f = d.getAttribute("data-font") as FontId | null;
    if (t && THEMES.some((x) => x.id === t)) setTheme(t);
    if (f && FONTS.some((x) => x.id === f)) setFont(f);
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickTheme(id: ThemeId) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem("spark-theme", id);
    } catch {
      /* storage unavailable — still applies this session */
    }
  }

  function pickFont(id: FontId) {
    setFont(id);
    document.documentElement.setAttribute("data-font", id);
    try {
      localStorage.setItem("spark-font", id);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Appearance settings"
        title="Appearance"
        className="rounded-lg border border-white/20 p-2 text-white/80 transition-colors hover:bg-white/10"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-brand border border-line bg-surface text-ink shadow-lg"
        >
          <div className="border-b border-line px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wide text-ink/50">
            Theme
          </div>
          <ul className="max-h-64 overflow-y-auto p-1.5">
            {THEMES.map((t) => {
              const active = t.id === theme;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pickTheme(t.id)}
                    aria-pressed={active}
                    className={
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors " +
                      (active ? "bg-paper2/70" : "hover:bg-paper2/40")
                    }
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 overflow-hidden rounded-md ring-1 ring-line"
                      aria-hidden
                    >
                      <span className="w-1/3" style={{ background: t.swatch[0] }} />
                      <span className="w-1/3" style={{ background: t.swatch[1] }} />
                      <span className="w-1/3" style={{ background: t.swatch[2] }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{t.label}</span>
                      <span className="block text-[0.65rem] leading-tight text-ink/50">{t.hint}</span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-y border-line px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wide text-ink/50">
            Font size
          </div>
          <div className="grid grid-cols-4 gap-1 p-1.5" role="group" aria-label="Font size">
            {FONTS.map((f) => {
              const active = f.id === font;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pickFont(f.id)}
                  aria-pressed={active}
                  title={`${f.label} (${f.px})`}
                  className={
                    "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors " +
                    (active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line text-ink/70 hover:bg-paper2/40")
                  }
                >
                  <span className={"font-display font-bold leading-none " + f.glyph}>A</span>
                  <span className="text-[0.55rem] leading-none">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
