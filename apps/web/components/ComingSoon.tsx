import Link from "next/link";

// Placeholder for nav sections whose real screens land in later epics. Keeps the
// workspace shell intact (sidebar + switcher) instead of 404-ing.
export function ComingSoon({
  title,
  slug,
  epic,
}: {
  title: string;
  slug: string;
  epic?: string;
}) {
  return (
    <div className="px-8 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      <span className="mt-2 inline-block rounded-lg border border-line bg-surface px-3 py-1 text-xs uppercase tracking-wide text-accent">
        Coming soon
      </span>
      <p className="mt-4 max-w-xl text-ink/70">
        This section isn&apos;t built yet
        {epic ? ` — it lands in ${epic}.` : "."} Auth, tenancy, the workspace
        switcher, and members are live; feature screens are being added one epic
        at a time.
      </p>
      <Link
        href={`/w/${slug}`}
        className="mt-6 inline-block font-medium text-accent underline"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
