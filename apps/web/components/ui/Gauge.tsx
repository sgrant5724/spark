import { STATUS, loadTone, scoreTone, type StatusTone } from "@/lib/viz";
import { cx } from "@/lib/cx";

/**
 * Radial gauge (SVG, brand). Encodes a value/max as arc fill + a colored center
 * readout. Two semantics:
 *   - default (`meaning="load"`): higher = worse → good→warn→critical
 *     (spend-cap %, idle age, pipeline load)
 *   - `meaning="score"`: higher = better → critical→warn→good
 *     (SEO score, WCAG pass %, readiness)
 * Pass an explicit `tone` to override. Accessible via role="img" + aria-label;
 * color is never the only signal (numeric readout is always present).
 */
export function Gauge({
  value,
  max,
  label,
  meaning = "load",
  tone,
  format,
  size = 120,
  className,
}: {
  value: number;
  max: number;
  label: string;
  meaning?: "load" | "score";
  tone?: StatusTone;
  /** center readout formatter; defaults to whole-percent */
  format?: (pct: number, value: number, max: number) => string;
  size?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const resolvedTone = tone ?? (meaning === "score" ? scoreTone(pct) : loadTone(pct));
  const stroke = STATUS[resolvedTone];
  const r = 42;
  const C = 2 * Math.PI * r;
  const dash = C * pct;
  const readout = format ? format(pct, value, max) : `${Math.round(pct * 100)}%`;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${label}: ${readout} (${value} of ${max})`}
      className={cx("animate-fade-in", className)}
      style={{ width: size, height: size, maxWidth: "100%" }}
    >
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E2EAF4" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        className="fill-ink font-mono"
        fontSize="17"
        fontWeight="700"
      >
        {readout}
      </text>
      <text x="50" y="63" textAnchor="middle" fill="#343433" fillOpacity="0.5" fontSize="7.5">
        {label}
      </text>
    </svg>
  );
}
