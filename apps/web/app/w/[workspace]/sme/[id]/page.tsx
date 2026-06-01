import { notFound } from "next/navigation";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { can } from "@spark/shared";
import { SmeProfileForm } from "@/components/SmeProfileForm";
import { updateSmeProfile } from "../actions";

export default async function EditSmeProfilePage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  const canManage = can(membership.role, "sme.manage");

  const profile = await withWorkspace(db, membership.workspaceId, (tx) =>
    tx.smeProfile.findFirst({
      where: { id: params.id, workspaceId: membership.workspaceId },
    }),
  );
  if (!profile) notFound();

  const data = (profile.profile as Record<string, string>) ?? {};

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">
        {canManage ? "Edit SME profile" : "SME profile"}
      </h1>
      <p className="mb-6 text-sm text-ink/60">
        {profile.name} · version {profile.version}
      </p>
      <SmeProfileForm
        slug={slug}
        action={updateSmeProfile}
        id={profile.id}
        name={profile.name}
        title={profile.title ?? ""}
        data={data}
        canManage={canManage}
      />
    </div>
  );
}
