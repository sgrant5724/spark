"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark theme switch. The actual theme is applied by a no-flash inline
 * script (root layout) that sets [data-theme] before paint; this control reads
 * that value on mount, then flips it and persists the choice to localStorage.
 * Styled for the always-dark app headers (white on nav) in both themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme");
    setTheme(cur === "dark" ? "dark" : "light");
  }, []);

  const isDark = theme === "dark";
  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("spark-theme", next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={
        "rounded-lg border border-white/20 p-2 text-white/80 transition-colors hover:bg-white/10 " +
        (className ?? "")
      }
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
