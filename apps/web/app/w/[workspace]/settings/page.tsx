import { ComingSoon } from "@/components/ComingSoon";

export default function Page({ params }: { params: { workspace: string } }) {
  return (
    <ComingSoon
      title="Settings"
      slug={params.workspace}
      epic="Epic 2 — Workspace Config (next: brand kit, heading styles, image sizes, motifs, SEO plugin, rendering profile)"
    />
  );
}
