import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Social"
      slug={params.workspace}
      epic="the Social Distribution epic (FR-12, via Uniple)"
    />
  );
}
