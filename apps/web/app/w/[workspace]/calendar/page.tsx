import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Calendar"
      slug={params.workspace}
      epic="the Automation & Scheduling epic (FR-13)"
    />
  );
}
