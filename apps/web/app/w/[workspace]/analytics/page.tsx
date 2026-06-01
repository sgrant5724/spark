import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Analytics"
      slug={params.workspace}
      epic="the Analytics & Feedback Loop epic (FR-14)"
    />
  );
}
