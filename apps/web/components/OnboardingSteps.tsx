import Link from "next/link";
import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * New-client onboarding stepper. Three steps that ground a fresh workspace:
 * describe the client → set the brand → find first ideas. The current step is
 * highlighted; completed steps show a check. Purely presentational; each step
 * links to its screen.
 */
export function OnboardingSteps({
  slug,
  current,
  orgComplete,
  hasIdeas,
}: {
  slug: string;
  current: 1 | 2 | 3;
  orgComplete: boolean;
  hasIdeas: boolean;
}) {
  const steps = [
    {
      n: 1 as const,
      label: "Describe the client",
      desc: "What they do — grounds every AI output",
      href: `/w/${slug}/organization`,
      done: orgComplete,
    },
    {
      n: 2 as const,
      label: "Set the brand",
      desc: "Colors, fonts, heading styles",
      href: `/w/${slug}/settings`,
      done: false,
    },
    {
      n: 3 as const,
      label: "Find first ideas",
      desc: "AI-discover topic ideas to draft",
      href: `/w/${slug}/ideas`,
      done: hasIdeas,
    },
  ];

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      {steps.map((s, i) => {
        const active = s.n === current;
        return (
          <li key={s.n} className="flex flex-1 items-stretch">
            <Link
              href={s.href}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                active
                  ? "border-orange bg-orange/5"
                  : s.done
                    ? "border-blue/30 bg-blue/5 hover:border-blue"
                    : "border-lightblue bg-white hover:border-blue",
              )}
            >
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                  s.done
                    ? "bg-blue text-white"
                    : active
                      ? "bg-orange text-white"
                      : "bg-paper2 text-ink/60",
                )}
                aria-hidden
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink">{s.label}</span>
                <span className="block text-[0.62rem] text-ink/50">{s.desc}</span>
              </span>
            </Link>
            {i < steps.length - 1 && (
              <span className="mx-1 hidden self-center text-ink/25 sm:block" aria-hidden>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
