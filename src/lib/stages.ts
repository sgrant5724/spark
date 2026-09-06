/**
 * The stages (One-Loop redesign) and which page belongs to which. Shared by
 * the rail (which stage to light), the persistent stage strip (which tabs to
 * show and which is current) and the stage pages themselves. Plain data and
 * regexes — safe to import from client components.
 *
 * `/brand` is not a loop stage but gets a strip the same way, because the
 * tone-and-motifs and organisation pages under /blog/ are Brand setup and
 * used to strand people on a Blog tab bar that belonged to no stage.
 */

export type StageTab = {
  href: string;
  label: string;
  /** Extra path prefixes that also count as this tab (e.g. a script editor). */
  also?: string[];
};

export type StageDef = {
  href: string;
  label: string;
  /** Tabs may depend on the active channel; null when the workspace has none. */
  tabs: (ctx: { channelId: string | null }) => StageTab[];
};

export const STAGE_HREFS = ["/research", "/ideas", "/drafts", "/review", "/publish", "/distribute", "/measure", "/brand"] as const;

export const STAGES: Record<(typeof STAGE_HREFS)[number], StageDef> = {
  "/research": {
    href: "/research",
    label: "Research",
    tabs: ({ channelId }) => [
      { href: "/intel", label: "Intel" },
      { href: "/intel/bookmarks", label: "Bookmarks" },
      ...(channelId ? [{ href: `/channels/${channelId}/competitors`, label: "Competitors", also: ["/channels/*/competitors", "/channels/*/research"] }] : []),
      { href: "/chat", label: "Chat" },
    ],
  },
  "/ideas": {
    href: "/ideas",
    label: "Ideas",
    tabs: () => [
      { href: "/blog/keywords", label: "Keywords" },
      { href: "/blog/experts", label: "Experts" },
    ],
  },
  "/drafts": {
    href: "/drafts",
    label: "Drafts",
    tabs: ({ channelId }) => [
      { href: "/blog", label: "Articles" },
      { href: "/blog/board", label: "Board" },
      { href: channelId ? `/channels/${channelId}/scripts` : "/scripts", label: "Scripts", also: ["/scripts", "/channels/*/scripts"] },
      { href: "/thumbnails", label: "Thumbnails" },
      { href: "/videos", label: "Videos" },
      { href: "/production", label: "Production" },
    ],
  },
  "/review": {
    href: "/review",
    label: "Review",
    tabs: () => [
      { href: "/social/approvals", label: "Approvals" },
      { href: "/blog/audit", label: "Audit" },
    ],
  },
  "/publish": {
    href: "/publish",
    label: "Publish",
    tabs: () => [
      { href: "/website", label: "Website" },
      { href: "/blog/calendar", label: "Blog calendar" },
      { href: "/blog/automation", label: "Automation" },
    ],
  },
  "/distribute": {
    href: "/distribute",
    label: "Distribute",
    tabs: () => [
      { href: "/social/compose", label: "Compose" },
      { href: "/social/calendar", label: "Calendar" },
      { href: "/social/engage", label: "Engage" },
      { href: "/social/settings", label: "Slots & settings" },
    ],
  },
  "/measure": {
    href: "/measure",
    label: "Measure",
    tabs: () => [
      { href: "/reports", label: "Reports" },
      { href: "/insights", label: "Insights" },
      { href: "/blog/analytics", label: "Blog analytics" },
      { href: "/blog/report", label: "Blog report" },
      { href: "/social/performance", label: "Social performance" },
    ],
  },
  "/brand": {
    href: "/brand",
    label: "Brand",
    tabs: () => [
      { href: "/blog/brand", label: "Tone & motifs" },
      { href: "/blog/organization", label: "Organization" },
    ],
  },
};

/** Which stage a page belongs to — the stage's own href included. */
export function stageFor(pathname: string): (typeof STAGE_HREFS)[number] | null {
  const p = pathname;
  for (const h of STAGE_HREFS) if (p === h || p.startsWith(h + "/")) return h;
  if (/^\/blog\/(brand|organization)(\/|$)/.test(p)) return "/brand";
  if (/^\/(intel|chat)(\/|$)/.test(p) || /^\/channels\/[^/]+\/(competitors|research)(\/|$)/.test(p)) return "/research";
  if (/^\/blog\/(keywords|experts)(\/|$)/.test(p) || /^\/channels\/[^/]+\/ideas(\/|$)/.test(p)) return "/ideas";
  if (/^\/social\/approvals(\/|$)/.test(p) || /^\/blog\/audit(\/|$)/.test(p)) return "/review";
  if (/^\/website(\/|$)/.test(p) || /^\/blog\/(calendar|automation)(\/|$)/.test(p)) return "/publish";
  if (/^\/(reports|insights)(\/|$)/.test(p) || /^\/blog\/(analytics|report)(\/|$)/.test(p) || /^\/social\/performance(\/|$)/.test(p)) return "/measure";
  if (/^\/social(\/|$)/.test(p)) return "/distribute";
  if (/^\/(scripts|thumbnails|videos|production)(\/|$)/.test(p) || /^\/channels\/[^/]+\/scripts(\/|$)/.test(p) || /^\/blog(\/|$)/.test(p)) return "/drafts";
  return null;
}

function prefixMatches(pathname: string, prefix: string): number {
  // "*" in a prefix stands for one path segment (a channel id).
  const re = new RegExp("^" + prefix.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+") + "(/|$)");
  return re.test(pathname) ? prefix.length : 0;
}

/** The current tab: the longest matching prefix wins, so /blog/board beats /blog. */
export function currentTab(pathname: string, tabs: StageTab[]): StageTab | null {
  let best: StageTab | null = null;
  let bestLen = 0;
  for (const t of tabs) {
    const candidates = [t.href.split("?")[0], ...(t.also ?? [])];
    for (const c of candidates) {
      const n = prefixMatches(pathname, c);
      if (n > bestLen) { best = t; bestLen = n; }
    }
  }
  return best;
}
