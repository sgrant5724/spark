import Link from "next/link";

/**
 * Shared dashboard widget kit — the foundation for Mission Control, the Pipeline
 * Rail stage dashboards, and the Agency Console. Presentational server
 * components; each owns a consistent card shell and its own empty state.
 */

export function Widget({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-brand border border-lightblue bg-white p-4 ${className}`}
    >
      {/* brand ribbon — the Spark gradient from the logo mark */}
      <span
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-orange via-yellow to-blue-bright"
        aria-hidden
      />
      {(title || action) && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {title && (
            <h2 className="font-display text-[0.7rem] font-semibold uppercase tracking-wide text-ink/50">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  delta,
  tone = "up",
  href,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "up" | "warn" | "flat";
  href?: string;
}) {
  const toneCls =
    tone === "warn" ? "text-orange" : tone === "flat" ? "text-ink/50" : "text-blue";
  const inner = (
    <>
      <p className="text-[0.65rem] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
      {delta && <p className={`mt-0.5 text-[0.65rem] font-semibold ${toneCls}`}>{delta}</p>}
    </>
  );
  const base = "block rounded-brand border border-lightblue bg-white p-4";
  return href ? (
    <Link href={href} className={`${base} transition-colors hover:border-blue`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/** SVG area sparkline with an emphasized endpoint. Accessible via aria-label. */
export function Sparkline({
  points,
  label,
  height = 48,
}: {
  points: number[];
  label: string;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="text-xs text-ink/40">Not enough data to chart yet.</p>;
  }
  const W = 300;
  const H = height;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - 4 - ((p - min) / range) * (H - 8);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const [ex, ey] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={label} style={{ height }}>
      <path d={area} fill="rgba(177,212,224,.35)" />
      <path d={line} fill="none" stroke="#0D5A84" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <circle cx={ex} cy={ey} r="3.5" fill="#C4571C" />
    </svg>
  );
}

/** Horizontal bars showing where the pipeline is loaded. */
export function PipelineBars({
  stages,
}: {
  stages: Array<{ label: string; count: number; tone?: "blue" | "orange" | "yellow" }>;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const fill: Record<string, string> = {
    blue: "linear-gradient(90deg,#B1D4E0,#0D5A84)",
    orange: "linear-gradient(90deg,#E6A877,#C4571C)",
    yellow: "linear-gradient(90deg,#F8CF40,#EBBE1F)",
  };
  return (
    <div className="flex flex-col gap-2">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 text-[0.65rem] uppercase tracking-wide text-ink/50">{s.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-paper2">
            <div
              className="h-full rounded"
              style={{ width: `${Math.max((s.count / max) * 100, s.count ? 6 : 0)}%`, background: fill[s.tone ?? "blue"] }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Month grid marking days that have scheduled/published articles. */
export function MiniCalendar({
  year,
  month,
  marks,
}: {
  year: number;
  month: number; // 0-indexed
  marks: Record<number, "published" | "scheduled">;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.55rem] uppercase text-ink/40">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const mark = day ? marks[day] : undefined;
          return (
            <span
              key={i}
              className={
                "flex aspect-square items-center justify-center rounded text-[0.6rem] tabular-nums " +
                (!day
                  ? ""
                  : mark === "published"
                    ? "bg-blue font-semibold text-white"
                    : mark === "scheduled"
                      ? "bg-yellow font-semibold text-ink"
                      : "bg-paper2 text-ink/60")
              }
            >
              {day ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Compact activity feed (AI actions, edits, approvals from the audit log). */
export function ActivityFeed({
  items,
}: {
  items: Array<{ text: React.ReactNode; when: string; hot?: boolean }>;
}) {
  if (items.length === 0) return <p className="text-xs text-ink/40">No recent activity.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="relative pl-4 text-[0.72rem] leading-snug text-ink/70">
          <span
            className={"absolute left-0 top-[0.4em] h-1.5 w-1.5 rounded-full " + (it.hot ? "bg-orange" : "bg-cyan")}
            aria-hidden
          />
          <span className="text-ink">{it.text}</span>
          <span className="ml-1 text-ink/40">· {it.when}</span>
        </li>
      ))}
    </ul>
  );
}

/** Queue of items needing attention, each linking to its detail. */
export function QueueList({
  items,
  empty = "Nothing here.",
}: {
  items: Array<{ href: string; title: string; chips?: Array<{ text: string; tone?: "warn" | "ok" }> }>;
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-xs text-ink/40">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i}>
          <Link
            href={it.href}
            className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-paper bg-paper/50 px-2.5 py-1.5 hover:border-blue"
          >
            <span className="truncate text-[0.78rem] font-medium text-ink">{it.title}</span>
            {it.chips && (
              <span className="flex shrink-0 gap-1">
                {it.chips.map((c, j) => (
                  <span
                    key={j}
                    className={
                      "rounded border px-1.5 py-0.5 text-[0.6rem] " +
                      (c.tone === "warn"
                        ? "border-orange/40 bg-white text-orange"
                        : "border-lightblue bg-white text-blue")
                    }
                  >
                    {c.text}
                  </span>
                ))}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
