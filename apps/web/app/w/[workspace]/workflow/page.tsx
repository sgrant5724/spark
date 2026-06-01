import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Workflow"
      slug={params.workspace}
      epic="the Approval Workflow epic (FR-10)"
    />
  );
}
