import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "@/components/widgets";
import { cx } from "@/lib/cx";

/**
 * KPI card: colored icon tile + label + big mono value + optional delta chip and
 * inline sparkline. The upgrade path for the flat `<Kpi>` tiles — same shell,
 * more signal. Delta direction is shown by an arrow icon (not color alone).
 */

type IconTone = "blue" | "orange" | "yellow" | "nav" | "cyan";

const TILE: Record<IconTone, string> = {
  blue: "bg-gradient-to-br from-blue-bright to-nav text-white shadow-sm",
  orange: "bg-gradient-to-br from-yellow to-orange text-white shadow-sm",
  yellow: "bg-gradient-to-br from-yellow to-orange/80 text-ink shadow-sm",
  nav: "bg-gradient-to-br from-blue to-nav2 text-white shadow-sm",
  cyan: "bg-gradient-to-br from-cyan to-blue-bright text-nav shadow-sm",
};

/** Subtle per-tone wash so the cards aren't flat white. */
const WASH: Record<IconTone, string> = {
  blue: "bg-gradient-to-br from-white via-white to-blue/5",
  orange: "bg-gradient-to-br from-white via-white to-orange/5",
  yellow: "bg-gradient-to-br from-white via-white to-yellow/10",
  nav: "bg-gradient-to-br from-white via-white to-nav/5",
  cyan: "bg-gradient-to-br from-white via-white to-cyan/15",
};

type DeltaDir = "up" | "down" | "flat";

const DELTA: Record<DeltaDir, { cls: string; Icon: typeof ArrowUpRight }> = {
  up: { cls: "text-blue bg-blue/5", Icon: ArrowUpRight },
  down: { cls: "text-orange bg-orange/5", Icon: ArrowDownRight },
  flat: { cls: "text-ink/50 bg-paper2", Icon: Minus },
};

export function StatCard({
  icon,
  iconTone = "blue",
  label,
  value,
  delta,
  spark,
  href,
  className,
}: {
  icon: React.ReactNode;
  iconTone?: IconTone;
  label: string;
  value: string | number;
  delta?: { text: string; dir: DeltaDir };
  spark?: { points: number[]; label: string };
  href?: string;
  className?: string;
}) {
  const D = delta ? DELTA[delta.dir] : null;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-[1.1rem] [&>svg]:w-[1.1rem]",
            TILE[iconTone],
          )}
          aria-hidden
        >
          {icon}
        </span>
        {D && delta && (
          <span
            className={cx(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold tabular-nums",
              D.cls,
            )}
          >
            <D.Icon className="h-3 w-3" aria-hidden />
            {delta.text}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[0.65rem] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums leading-tight text-ink">{value}</p>
      {spark && (
        <div className="mt-1.5">
          <Sparkline points={spark.points} label={spark.label} height={32} />
        </div>
      )}
    </>
  );

  const base = cx("block rounded-brand border border-lightblue p-4 shadow-sm", WASH[iconTone]);
  return href ? (
    <Link href={href} className={cx(base, "transition-colors hover:border-blue", className)}>
      {inner}
    </Link>
  ) : (
    <div className={cx(base, className)}>{inner}</div>
  );
}
