"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * Accessible tooltip — shows on hover AND keyboard focus, wired via
 * aria-describedby. The trigger is focusable (tabIndex 0) so keyboard users can
 * reach it; Escape dismisses. Purely presentational content — never put
 * essential-only information here (WCAG 1.4.13).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cx("relative inline-flex", className)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cx(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-nav px-2 py-1 text-[0.7rem] font-medium leading-snug text-white shadow-md animate-fade-in",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
