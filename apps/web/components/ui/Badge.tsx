import { cx } from "@/lib/cx";

/**
 * Small status/label chip. Tones map to the data-viz status ramp (no green).
 * `live` gets a pulsing dot + glow for hot/real-time states. Always readable
 * without color alone — pair with `dot` or an icon when tone carries meaning.
 */

type Tone = "neutral" | "blue" | "warn" | "critical" | "live";

const TONES: Record<Tone, string> = {
  neutral: "border-lightblue bg-white text-ink/70",
  blue: "border-lightblue bg-blue/5 text-blue",
  warn: "border-orange/40 bg-orange/5 text-orange",
  critical: "border-status-critical/40 bg-status-critical/5 text-status-critical",
  live: "border-yellow bg-yellow/10 text-ink shadow-glow",
};

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-ink/40",
  blue: "bg-blue",
  warn: "bg-orange",
  critical: "bg-status-critical",
  live: "bg-yellow",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            DOT_TONES[tone],
            tone === "live" && "animate-pulse",
          )}
          aria-hidden
        />
      )}
      {icon}
      {children}
    </span>
  );
}
