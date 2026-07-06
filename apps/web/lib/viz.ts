// Data-viz theme — raw color values for Recharts (which takes props, not
// Tailwind classes) and the hand-rolled SVG micro-widgets. Brand-derived,
// no green (warn=orange, critical=red, good/info stay in the blue/yellow family).
// Keep in sync with the `status`/`seq` tokens in tailwind.config.ts.

/** Categorical series colors — ordered for max adjacent contrast. */
export const CATEGORICAL = [
  "#0D5A84", // primary blue
  "#C4571C", // orange
  "#1A7AAB", // bright blue
  "#F8CF40", // yellow
  "#0A3A56", // deep nav
  "#6FA8C4", // mid blue
  "#C0392B", // red
  "#B1D4E0", // light blue
] as const;

/** Sequential blue ramp (low → high) for heatmap / intensity encoding. */
export const SEQUENTIAL = [
  "#EAF2F7",
  "#B1D4E0",
  "#6FA8C4",
  "#2E7BA6",
  "#0D5A84",
  "#0A3A56",
] as const;

/** Status colors — always render alongside an icon/label, never color alone. */
export const STATUS = {
  good: "#0D5A84",
  info: "#F8CF40",
  warn: "#C4571C",
  critical: "#C0392B",
} as const;

/** Shared neutrals for chart chrome. */
export const CHART = {
  grid: "#E2EAF4", // gridlines (paper2)
  axis: "#8A97A6", // axis text/ticks
  ink: "#343433",
} as const;

export type StatusTone = keyof typeof STATUS;

/**
 * Map a 0..1 ratio to a status tone for "usage/load" style meters where
 * higher = worse (spend cap, idle age, pipeline load). Pairs with an icon.
 */
export function loadTone(ratio: number): StatusTone {
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.7) return "warn";
  return "good";
}

/**
 * Map a 0..1 score to a status tone where higher = better (SEO score, WCAG
 * pass %, readiness). Inverse of loadTone.
 */
export function scoreTone(ratio: number): StatusTone {
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.5) return "warn";
  return "critical";
}

/** Pick a sequential-ramp color for a 0..1 intensity. */
export function seqColor(ratio: number): string {
  const i = Math.min(
    SEQUENTIAL.length - 1,
    Math.max(0, Math.round(ratio * (SEQUENTIAL.length - 1))),
  );
  return SEQUENTIAL[i];
}
