import { STATUS, loadTone, scoreTone, type StatusTone } from "@/lib/viz";
import { cx } from "@/lib/cx";

/**
 * Linear meter — a labeled progress bar with a threshold-colored fill and a mono
 * readout. Same load/score semantics as <Gauge>. Uses role="meter" (aria 1.1)
 * with value bounds for screen readers. Fill animates in (reduced-motion aware
 * via the global @media rule).
 */
export function Meter({
  value,
  max,
  label,
  meaning = "load",
  tone,
  unit,
  showValue = true,
  className,
}: {
  value: number;
  max: number;
  label: string;
  meaning?: "load" | "score";
  tone?: StatusTone;
  unit?: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const resolvedTone = tone ?? (meaning === "score" ? scoreTone(pct) : loadTone(pct));
  const fill = STATUS[resolvedTone];

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-ink/50">{label}</span>
        {showValue && (
          <span className="font-mono text-xs font-semibold tabular-nums text-ink">
            {value}
            {unit ? <span className="text-ink/50">{unit}</span> : null}
            <span className="text-ink/40">
              {" "}/ {max}
              {unit ?? ""}
            </span>
          </span>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-paper2"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full origin-left rounded-full animate-fill-bar"
          style={{ width: `${pct * 100}%`, background: fill }}
        />
      </div>
    </div>
  );
}
