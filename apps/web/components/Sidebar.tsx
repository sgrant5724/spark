import Link from "next/link";

// Nav items mirror the M2 dashboard. Every link resolves; sections not yet built
// render a "coming soon" stub so the shell stays intact.
const NAV: Array<{ label: string; href: (slug: string) => string }> = [
  { label: "Dashboard", href: (s) => `/w/${s}` },
  { label: "SME Profiles", href: (s) => `/w/${s}/sme` },
  { label: "Ideas", href: (s) => `/w/${s}/ideas` },
  { label: "Content", href: (s) => `/w/${s}/content` },
  { label: "Workflow", href: (s) => `/w/${s}/workflow` },
  { label: "Calendar", href: (s) => `/w/${s}/calendar` },
  { label: "Social", href: (s) => `/w/${s}/social` },
  { label: "Analytics", href: (s) => `/w/${s}/analytics` },
  { label: "Members", href: (s) => `/w/${s}/members` },
  { label: "Settings", href: (s) => `/w/${s}/settings` },
];

export function Sidebar({ slug }: { slug: string }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Primary">
      {NAV.map((item) => (
        <Link
          key={item.label}
          href={item.href(slug)}
          className="rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
