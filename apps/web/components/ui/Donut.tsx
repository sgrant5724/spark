import { cx } from "@/lib/cx";

/**
 * Donut chart (SVG, brand) — a lightweight alternative to a charting lib for
 * small categorical breakdowns (intent mix, motif mix, traffic by audience).
 * Segments render as dashed arcs; an optional center label shows the total.
 * Accessible via role="img" + aria-label enumerating the segments.
 */
export function Donut({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  className,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 50 - thickness / 2;
  const C = 2 * Math.PI * r;

  return (
    <div className={cx("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size, maxWidth: "100%" }}
        role="img"
        aria-label={
          total === 0
            ? "No data"
            : segments.filter((s) => s.value).map((s) => `${s.label}: ${s.value}`).join(", ")
        }
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E2EAF4" strokeWidth={thickness} />
        {total > 0 &&
          (() => {
            let acc = 0;
            return segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const frac = s.value / total;
                const dash = frac * C;
                const rot = acc * 360 - 90;
                acc += frac;
                return (
                  <circle
                    key={s.label}
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${C - dash}`}
                    transform={`rotate(${rot} 50 50)`}
                  />
                );
              });
          })()}
        {centerLabel && (
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-ink font-mono"
            fontSize="15"
            fontWeight="700"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="flex min-w-0 flex-col gap-1 text-[0.68rem]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="truncate text-ink/70">{s.label}</span>
            <span className="ml-auto font-mono tabular-nums text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
