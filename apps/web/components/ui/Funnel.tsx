import { cx } from "@/lib/cx";

/**
 * Pipeline funnel — proportional tapering bars for a set of ordered stages, with
 * the step-to-step retention shown between them. Counts are a current-state
 * snapshot (how many items sit in each stage now), so the between-stage figure
 * is labeled as a share of the previous stage, not a cohort conversion rate.
 * Presentational server component.
 */
export function Funnel({
  stages,
}: {
  stages: Array<{ label: string; count: number; href?: string }>;
}) {
  const top = Math.max(stages[0]?.count ?? 0, 1);
  const maxAny = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="flex flex-col gap-1">
      {stages.map((s, i) => {
        const widthPct = Math.max((s.count / maxAny) * 100, s.count ? 8 : 4);
        const prev = i > 0 ? stages[i - 1].count : null;
        const stepPct =
          prev != null && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        // deepen the blue as we go down the funnel
        const shade = ["#B1D4E0", "#6FA8C4", "#2E7BA6", "#0D5A84", "#0A3A56"][
          Math.min(i, 4)
        ];
        return (
          <div key={s.label}>
            {i > 0 && stepPct != null && (
              <div className="flex justify-center py-0.5">
                <span className="font-mono text-[0.55rem] tabular-nums text-ink/40">
                  {stepPct}% of prev
                </span>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-right text-[0.62rem] uppercase tracking-wide text-ink/50">
                {s.label}
              </span>
              <div className="flex flex-1 justify-center">
                <div
                  className="flex h-7 items-center justify-center rounded transition-all"
                  style={{ width: `${widthPct}%`, minWidth: "2rem", background: shade }}
                >
                  <span
                    className={cx(
                      "font-mono text-xs font-bold tabular-nums",
                      i >= 2 ? "text-white" : "text-nav",
                    )}
                  >
                    {s.count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <p className="mt-1 text-center font-mono text-[0.55rem] text-ink/40">
        {Math.round(((stages[stages.length - 1]?.count ?? 0) / top) * 100)}% of ideas reach live
      </p>
    </div>
  );
}
