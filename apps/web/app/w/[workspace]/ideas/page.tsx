import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Ideas"
      slug={params.workspace}
      epic="the Idea Engine epic (FR-5)"
    />
  );
}
