import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";

// Editorial calendar (read view): scheduled + published articles by month.
// Cadence rules & automated scheduling arrive with the Redis-backed runner.
export default async function CalendarPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);

  const articles = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.article.findMany({
      where: {
        workspaceId: membership.workspaceId,
        state: { in: ["scheduled", "published", "distributed", "analyzing"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  );

  const byMonth = new Map<string, typeof articles>();
  for (const a of articles) {
    const d = new Date(a.updatedAt);
    const key = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(a);
  }

  return (
    <div className="px-8 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Calendar</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Publishing timeline. Cadence rules (e.g. one cornerstone + two supporting
        per month) and automated scheduling land with the job runner (V1).
      </p>

      {byMonth.size === 0 ? (
        <p className="text-ink/70">Nothing scheduled or published yet.</p>
      ) : (
        <div className="space-y-6">
          {[...byMonth.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-2 font-display text-lg font-semibold text-ink">{month}</h2>
              <ul className="space-y-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/w/${slug}/content/${a.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-brand border border-lightblue bg-white px-4 py-2.5 hover:border-blue"
                    >
                      <span className="text-sm font-medium text-ink">{a.title}</span>
                      <span className="flex items-center gap-2 text-xs text-ink/50">
                        {new Date(a.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        <span
                          className={
                            "rounded border px-2 py-0.5 " +
                            (a.state === "scheduled"
                              ? "border-orange/40 bg-orange/5 text-orange"
                              : "border-yellow bg-yellow/20 text-ink")
                          }
                        >
                          {a.state}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
