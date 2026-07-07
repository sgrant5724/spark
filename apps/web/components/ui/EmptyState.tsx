import { cx } from "@/lib/cx";

/**
 * Empty-state block — icon + message + optional CTA. Replaces bare "Empty" /
 * "Nothing here" text. Truthfulness guardrail: empty states describe the absence
 * of data; they never invent placeholder numbers.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-lightblue bg-paper/40 px-4 py-8 text-center",
        className,
      )}
    >
      {icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan/40 to-blue/15 text-blue [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink/50">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
