import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth-helpers";
import { can } from "@spark/shared";
import { SmeProfileForm } from "@/components/SmeProfileForm";
import { createSmeProfile } from "../actions";

export default async function NewSmeProfilePage({
  params,
}: {
  params: { workspace: string };
}) {
  const slug = params.workspace;
  const { membership } = await requireMembership(slug);
  if (!can(membership.role, "sme.manage")) redirect(`/w/${slug}/sme`);

  return (
    <div className="px-8 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink">
        New SME profile
      </h1>
      <SmeProfileForm slug={slug} action={createSmeProfile} canManage />
    </div>
  );
}
