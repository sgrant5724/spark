import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Content"
      slug={params.workspace}
      epic="the Generation epic (FR-6)"
    />
  );
}
