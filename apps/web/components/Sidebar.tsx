"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChartLine,
  FileText,
  GitBranch,
  GraduationCap,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  Settings,
  Share2,
  Target,
  Users,
} from "lucide-react";

// Primary nav (M2 shell). Client component so the active section carries
// aria-current + visual state. Horizontal scroll strip on mobile.
const NAV: Array<{
  label: string;
  href: (slug: string) => string;
  exact?: boolean;
  Icon: LucideIcon;
}> = [
  { label: "Dashboard", href: (s) => `/w/${s}`, exact: true, Icon: LayoutDashboard },
  { label: "Pipeline", href: (s) => `/w/${s}/pipeline`, Icon: GitBranch },
  { label: "Organization", href: (s) => `/w/${s}/organization`, Icon: Building2 },
  { label: "SME Profiles", href: (s) => `/w/${s}/sme`, Icon: GraduationCap },
  { label: "Strategy", href: (s) => `/w/${s}/strategy`, Icon: Target },
  { label: "Ideas", href: (s) => `/w/${s}/ideas`, Icon: Lightbulb },
  { label: "Content", href: (s) => `/w/${s}/content`, Icon: FileText },
  { label: "Workflow", href: (s) => `/w/${s}/workflow`, Icon: KanbanSquare },
  { label: "Calendar", href: (s) => `/w/${s}/calendar`, Icon: CalendarDays },
  { label: "Social", href: (s) => `/w/${s}/social`, Icon: Share2 },
  { label: "Analytics", href: (s) => `/w/${s}/analytics`, Icon: ChartLine },
  { label: "Members", href: (s) => `/w/${s}/members`, Icon: Users },
  { label: "Settings", href: (s) => `/w/${s}/settings`, Icon: Settings },
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
              "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors " +
              (active
                ? "border border-lightblue/50 bg-lightblue/20 font-semibold text-white"
                : "text-white/80 hover:bg-white/10")
            }
          >
            <item.Icon
              className={"h-[1.05rem] w-[1.05rem] shrink-0 " + (active ? "text-yellow" : "text-cyan")}
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
