import { cx } from "@/lib/cx";

/**
 * Shimmer placeholder for async widgets. The moving highlight is decorative and
 * collapses under prefers-reduced-motion (global rule). aria-hidden — loading
 * state should be announced by the container's aria-busy, not by each bar.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative block overflow-hidden rounded-md bg-paper2",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className,
      )}
    />
  );
}

/** Convenience: a stack of text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
