"use client";

import { forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * The one button. Replaces the ad-hoc `rounded-lg bg-orange px-4 py-2 …` classes
 * scattered across the app. Variants map to the brand palette (no green);
 * `danger` is the only red in the UI. Loading state is either explicit (`loading`)
 * or, for submit buttons inside a <form>, driven automatically by useFormStatus —
 * so server-action forms get a spinner + disabled state for free.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-yellow to-orange text-white hover:brightness-105 active:brightness-95 shadow-sm",
  secondary:
    "bg-gradient-to-br from-blue-bright to-nav text-white hover:brightness-110 active:brightness-95 shadow-sm",
  ghost:
    "bg-transparent text-ink hover:bg-paper2 border border-line",
  danger:
    "bg-gradient-to-br from-status-critical to-orange text-white hover:brightness-105 shadow-sm",
  icon: "bg-transparent text-ink/70 hover:bg-paper2 hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

const ICON_SIZES: Record<Size, string> = {
  sm: "p-1.5",
  md: "p-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    leftIcon,
    rightIcon,
    type = "button",
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  // useFormStatus reads the nearest enclosing <form>; returns pending=false when
  // there is none, so this is safe for non-form buttons too.
  const { pending } = useFormStatus();
  const isLoading = loading ?? (type === "submit" ? pending : false);
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-display font-semibold",
        "transition-colors duration-150 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "icon" ? ICON_SIZES[size] : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        leftIcon
      )}
      {variant !== "icon" && children}
      {!isLoading && rightIcon}
    </button>
  );
});
