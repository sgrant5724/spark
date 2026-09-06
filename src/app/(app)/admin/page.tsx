import Link from "next/link";
import { requireRole } from "@/lib/acl";
import { PeoplePanel } from "@/components/PeoplePanel";

// MU-14 — Users & Roles (Admin). Since One-Loop step 5 the panel itself lives
// in components/PeoplePanel and also renders under Settings → People; this
// location keeps working for a release.

export default async function AdminUsersPage() {
  const { workspace } = await requireRole("ADMIN");
  return (
    <div className="w-full">
      <h1 className="font-mono font-bold text-xl mb-1">Users & Roles</h1>
      <p className="text-sm text-[var(--mute)] mb-5">
        Workspace: <b>{workspace.name}</b> · also under <Link href="/setup/people" className="underline">Settings → People</Link>, with the approval dial.
      </p>
      <PeoplePanel workspaceId={workspace.id} workspaceName={workspace.name} returnTo="/admin" />
    </div>
  );
}
