import Link from "next/link";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { can } from "@spark/shared";

export default async function SmeListPage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const canManage = can(membership.role, "sme.manage");

  const profiles = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.smeProfile.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: "asc" },
    }),
  );

  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">SME Profiles</h1>
        {canManage && (
          <Link
            href={`/w/${slug}/sme/new`}
            className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
          >
            + New profile
          </Link>
        )}
      </header>
      <p className="mb-6 max-w-2xl text-sm text-ink/60">
        Capture each expert&apos;s knowledge once so drafts answer &ldquo;as the
        expert would&rdquo; — replacing the per-article interview (FR-3).
      </p>

      {profiles.length === 0 ? (
        <p className="text-ink/70">
          No SME profiles yet.{" "}
          {canManage ? "Create one to ground generated drafts in real expertise." : ""}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <Link
                href={`/w/${slug}/sme/${p.id}`}
                className="block rounded-brand border border-lightblue bg-white px-4 py-3 hover:border-blue"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className="text-xs uppercase tracking-wide text-blue">
                    v{p.version}
                  </span>
                </div>
                {p.title && (
                  <span className="text-sm text-ink/60">{p.title}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-ink/50">
        Voice intake and source ingestion (website, agreements, prior articles)
        are coming in a later iteration — text intake first.
      </p>
    </div>
  );
}
