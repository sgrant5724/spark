import { redirect } from "next/navigation";
import Link from "next/link";
import { SparkLogo } from "@/components/SparkLogo";
import { getSessionUserId, getUserMemberships } from "@/lib/auth-helpers";

// Entry point: send signed-out users to /login, route members straight into
// their workspace, and show a chooser when they belong to several.
export default async function Home() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const memberships = await getUserMemberships(userId);
  if (memberships.length === 1) redirect(`/w/${memberships[0].workspaceSlug}`);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-8 py-20">
      <div className="mb-8 flex items-center gap-3">
        <SparkLogo size={36} />
        <h1 className="font-display text-2xl font-bold text-ink">
          Choose a workspace
        </h1>
      </div>

      {memberships.length === 0 ? (
        <p className="text-ink/70">
          Your account isn&apos;t a member of any workspace yet. Ask an admin to
          invite you.
        </p>
      ) : (
        <ul className="space-y-2">
          {memberships.map((m) => (
            <li key={m.workspaceId}>
              <Link
                href={`/w/${m.workspaceSlug}`}
                className="flex items-center justify-between rounded-brand border border-lightblue bg-white px-4 py-3 hover:border-blue"
              >
                <span className="font-medium text-ink">{m.workspaceName}</span>
                <span className="text-xs uppercase tracking-wide text-blue">
                  {m.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
