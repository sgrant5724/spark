"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Primary nav (M2 shell). Client component so the active section carries
// aria-current + visual state. Horizontal scroll strip on mobile.
const NAV: Array<{ label: string; href: (slug: string) => string; exact?: boolean }> = [
  { label: "Dashboard", href: (s) => `/w/${s}`, exact: true },
  { label: "Pipeline", href: (s) => `/w/${s}/pipeline` },
  { label: "Organization", href: (s) => `/w/${s}/organization` },
  { label: "SME Profiles", href: (s) => `/w/${s}/sme` },
  { label: "Strategy", href: (s) => `/w/${s}/strategy` },
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
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-x-visible md:py-4"
      aria-label="Primary"
    >
      {NAV.map((item) => {
        const href = item.href(slug);
        const active = item.exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm " +
              (active
                ? "border border-lightblue/50 bg-lightblue/20 font-semibold text-white"
                : "text-white/80 hover:bg-white/10")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
