/**
 * Spark seed — LSI Media workspace, the 7 Motifs™, brand/heading/image config,
 * the four-tier keyword model, and representative pages.
 *
 * Runs as the schema OWNER (DATABASE_URL), which bypasses RLS by design.
 * Idempotent: upserts on natural keys so it can be re-run safely.
 *
 * Truthfulness guardrail (FR-6): keyword `volume`/`difficulty` are left NULL.
 * They are populated only from real research integrations — never invented.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// LSI Media brand tokens (from the requirements spec / brand board).
const BRAND_COLORS = {
  primaryBlue: "#0D5A84",
  primaryGray: "#343433",
  orange: "#C4571C",
  yellow: "#F8CF40",
  lightBlue: "#B1D4E0",
  paper: "#EFF3FA",
  deepNav: "#0A3A56",
  white: "#FFFFFF",
} as const;

const BRAND_FONTS = {
  ui: "Quicksand",
  display: "Kollektif, Quicksand",
} as const;

// The 7 Motifs™ as editable, versioned style directives.
const MOTIFS: Array<{
  key: string;
  name: string;
  directive: Prisma.InputJsonValue;
}> = [
  {
    key: "visionary",
    name: "Visionary",
    directive: {
      voice: "Bold, future-facing, big-picture",
      bestFit: "Trend pieces, AI-search/GEO, 'state of' articles",
      evidence: "Forward-looking analysis grounded in cited signals",
      cta: "See what's next / book a strategy call",
    },
  },
  {
    key: "competitive",
    name: "Competitive",
    directive: {
      voice: "Direct, comparative, confident",
      bestFit: "'Why choose / vs.' buyer guides",
      evidence: "Feature/price/benefit comparisons against alternatives",
      cta: "Compare us / get a quote",
    },
  },
  {
    key: "succinct",
    name: "Succinct",
    directive: {
      voice: "Tight, scannable, answer-first",
      bestFit: "How-to, checklists, FAQs",
      evidence: "Essential information upfront; no hunting",
      cta: "Get the checklist",
    },
  },
  {
    key: "sincere",
    name: "Sincere",
    directive: {
      voice: "Warm, candid, problem-led",
      bestFit: "Nonprofit content, pain-point explainers",
      evidence: "Authentic focus on real pain points over selling",
      cta: "Let's talk through it",
    },
  },
  {
    key: "exclusive",
    name: "Exclusive",
    directive: {
      voice: "Insider, premium",
      bestFit: "Case studies, gated guides",
      evidence: "VIP, insider framing that makes the reader feel significant",
      cta: "Request access",
    },
  },
  {
    key: "social",
    name: "Social",
    directive: {
      voice: "Inclusive, values-driven",
      bestFit: "Community, mission, association content",
      evidence: "Shared values; invites the reader to 'join'",
      cta: "Join the conversation",
    },
  },
  {
    key: "informative",
    name: "Informative",
    directive: {
      voice: "Consultative, evidence-based",
      bestFit: "Cornerstone guides, Section 508 / WCAG, capability statements",
      evidence: "Educational, source-backed, consultative",
      cta: "See our services",
    },
  },
];

// Article-scoped heading styles (px) — H1–H3 from mockup M9, H4–H6 sensible defaults.
const HEADING_STYLES = [
  { level: 1, fontPx: 40, marginTopPx: 0, marginBottomPx: 16 },
  { level: 2, fontPx: 30, marginTopPx: 28, marginBottomPx: 10 },
  { level: 3, fontPx: 22, marginTopPx: 20, marginBottomPx: 8 },
  { level: 4, fontPx: 18, marginTopPx: 16, marginBottomPx: 6 },
  { level: 5, fontPx: 16, marginTopPx: 14, marginBottomPx: 6 },
  { level: 6, fontPx: 14, marginTopPx: 12, marginBottomPx: 6 },
];

// Default Avada/Fusion content-pattern → element mapping (FR-18).
const AVADA_ELEMENT_MAP = {
  checklist: "fusion_checklist",
  callout: "fusion_content_box",
  note: "fusion_alert",
  quote: "fusion_pullquote",
  faq: "fusion_toggle",
  cta: "fusion_button",
  section_break: "fusion_separator",
} as const;

async function main() {
  // --- organization + workspace --------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: "lsi-media" },
    update: { name: "LSI Media LLC" },
    create: { name: "LSI Media LLC", slug: "lsi-media" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "lsi-media" },
    update: { name: "LSI Media", organizationId: org.id },
    create: {
      name: "LSI Media",
      slug: "lsi-media",
      organizationId: org.id,
      status: "active",
    },
  });
  const workspaceId = workspace.id;

  // --- brand kit -------------------------------------------------------------
  await prisma.brandKit.upsert({
    where: { workspaceId },
    update: { colors: BRAND_COLORS, fonts: BRAND_FONTS },
    create: {
      workspaceId,
      colors: BRAND_COLORS,
      fonts: BRAND_FONTS,
      footerCredit: "Built by LSI Media",
    },
  });

  // --- heading styles --------------------------------------------------------
  for (const hs of HEADING_STYLES) {
    await prisma.headingStyle.upsert({
      where: { workspaceId_level: { workspaceId, level: hs.level } },
      update: hs,
      create: { workspaceId, ...hs },
    });
  }

  // --- image spec (editable dimensions) -------------------------------------
  await prisma.imageSpec.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      featuredW: 1920,
      featuredH: 1080,
      ogW: 1200,
      ogH: 630,
      brandOg: true,
      brandInbody: false,
    },
  });

  // --- rendering profile (Avada/Fusion default) -----------------------------
  const existingProfile = await prisma.renderingProfile.findFirst({
    where: { workspaceId, type: "avada_fusion" },
  });
  if (existingProfile) {
    await prisma.renderingProfile.update({
      where: { id: existingProfile.id },
      data: { isDefault: true, elementMap: AVADA_ELEMENT_MAP },
    });
  } else {
    await prisma.renderingProfile.create({
      data: {
        workspaceId,
        type: "avada_fusion",
        isDefault: true,
        elementMap: AVADA_ELEMENT_MAP,
      },
    });
  }

  // --- SEO settings (Open Decision #1: blog slug rule unconfirmed) ----------
  await prisma.seoSettings.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      plugin: "squirrly",
      blogSlugRule: "needs_confirmation", // confirm against live site before publish
      slugRules: { blog: "{slug}", service: "{slug}" },
    },
  });

  // --- 7 Motifs --------------------------------------------------------------
  for (const [i, m] of MOTIFS.entries()) {
    await prisma.motif.upsert({
      where: { workspaceId_key: { workspaceId, key: m.key } },
      update: { name: m.name, directive: m.directive, position: i },
      create: {
        workspaceId,
        key: m.key,
        name: m.name,
        directive: m.directive,
        position: i,
      },
    });
  }

  // --- motif defaults (by tier/audience + social channel) -------------------
  const motifDefaults = [
    { tier: 4, audience: "Nonprofit", channel: null, motifMix: { sincere: 0.6, informative: 0.4 } },
    { tier: 2, audience: "Commercial", channel: null, motifMix: { competitive: 0.6, succinct: 0.4 } },
    { tier: null, audience: null, channel: "social", motifMix: { social: 1 } },
  ];
  // motif_defaults has no natural unique key; reset then insert for idempotency.
  await prisma.motifDefault.deleteMany({ where: { workspaceId } });
  for (const md of motifDefaults) {
    await prisma.motifDefault.create({ data: { workspaceId, ...md, motifMix: md.motifMix } });
  }

  // --- automation settings (supervised defaults; review-only) ---------------
  for (const contentType of ["cornerstone", "supporting"]) {
    await prisma.automationSetting.upsert({
      where: { workspaceId_contentType: { workspaceId, contentType } },
      update: {},
      create: {
        workspaceId,
        contentType,
        mode: "manual",
        autoPublish: false,
        spendCap: new Prisma.Decimal("120.00"),
        maxAutoPublish: 0,
        quietHours: { start: "20:00", end: "07:00" },
        globalPause: false,
      },
    });
  }

  // --- pages (internal-link graph seed) -------------------------------------
  const pageDefs = [
    { url: "/accessibility/", pageType: "hub" as const, primaryKeyword: "web accessibility services", suggestedH1: "Web Accessibility Services" },
    { url: "/section-508-compliance/", pageType: "deliverable" as const, primaryKeyword: "Section 508 compliance", suggestedH1: "Section 508 Compliance" },
    { url: "/nonprofit-web-design/", pageType: "audience_landing" as const, primaryKeyword: "nonprofit web design", suggestedH1: "Nonprofit Web Design" },
    { url: "/capability-statement/", pageType: "deliverable" as const, primaryKeyword: "capability statement", suggestedH1: "Capability Statements for Federal Contractors" },
    { url: "/contact/", pageType: "conversion" as const, primaryKeyword: "contact LSI Media", suggestedH1: "Contact Us" },
  ];
  const pages: Record<string, string> = {};
  for (const p of pageDefs) {
    const existing = await prisma.page.findFirst({ where: { workspaceId, url: p.url } });
    const page = existing
      ? await prisma.page.update({ where: { id: existing.id }, data: p })
      : await prisma.page.create({ data: { workspaceId, ...p } });
    pages[p.url] = page.id;
  }

  // --- four-tier keyword model (representative; volume/difficulty stay NULL) -
  // Tier 1 = head/brand, Tier 2 = commercial service, Tier 3 = supporting,
  // Tier 4 = informational/long-tail. (50/25/15/10 audience weighting per spec.)
  const keywords = [
    { tier: 1, phrase: "web design agency", service: "Web Design", audience: "All", intent: "commercial" as const, targetUrl: "/accessibility/" },
    { tier: 2, phrase: "accessible web design services", service: "Accessibility", audience: "Commercial", intent: "commercial" as const, targetUrl: "/accessibility/" },
    { tier: 2, phrase: "Section 508 compliance services", service: "Accessibility", audience: "Federal", intent: "commercial" as const, targetUrl: "/section-508-compliance/" },
    { tier: 3, phrase: "nonprofit website best practices", service: "Web Design", audience: "Nonprofit", intent: "informational" as const, targetUrl: "/nonprofit-web-design/" },
    { tier: 4, phrase: "what is Section 508 compliance", service: "Accessibility", audience: "All", intent: "informational" as const, targetUrl: "/section-508-compliance/" },
    { tier: 4, phrase: "WCAG 2.1 AA checklist", service: "Accessibility", audience: "All", intent: "informational" as const, targetUrl: "/accessibility/" },
    { tier: 4, phrase: "capability statement examples", service: "Federal", audience: "Federal", intent: "informational" as const, targetUrl: "/capability-statement/" },
  ];
  for (const k of keywords) {
    const targetPageId = pages[k.targetUrl] ?? null;
    const existing = await prisma.keyword.findFirst({ where: { workspaceId, phrase: k.phrase } });
    const data = {
      tier: k.tier,
      phrase: k.phrase,
      service: k.service,
      audience: k.audience,
      intent: k.intent,
      targetPageId,
      // volume & difficulty intentionally omitted — real research data only.
    };
    if (existing) {
      await prisma.keyword.update({ where: { id: existing.id }, data });
    } else {
      await prisma.keyword.create({ data: { workspaceId, ...data } });
    }
  }

  // --- internal-link graph edges (hub ↔ deliverables/landing) ---------------
  const edges = [
    { from: "/accessibility/", to: "/section-508-compliance/", anchor: "Section 508 compliance" },
    { from: "/section-508-compliance/", to: "/accessibility/", anchor: "web accessibility services" },
    { from: "/nonprofit-web-design/", to: "/accessibility/", anchor: "accessible web design" },
    { from: "/capability-statement/", to: "/contact/", anchor: "contact us" },
  ];
  for (const e of edges) {
    const fromPageId = pages[e.from];
    const toPageId = pages[e.to];
    if (!fromPageId || !toPageId) continue;
    await prisma.pageLink.upsert({
      where: { fromPageId_toPageId: { fromPageId, toPageId } },
      update: { anchorText: e.anchor },
      create: { workspaceId, fromPageId, toPageId, anchorText: e.anchor },
    });
  }

  // --- stakeholder users + memberships (invited; no passwords set) ----------
  // Per FR-1, accounts are created WITHOUT passwords — each user activates their
  // own (locally, run `pnpm --filter @spark/db set-password <email> <password>`).
  const userDefs = [
    { email: "sabine@lsi-media.com", name: "Sabine Grant", role: "owner" as const },
    { email: "idris@lsi-media.com", name: "Idris Grant", role: "sme" as const },
  ];
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name },
    });
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: { role: u.role },
      create: { workspaceId, userId: user.id, role: u.role },
    });
  }

  console.log(`Seeded workspace "${workspace.slug}" (${workspaceId}):`);
  console.log(`  • ${userDefs.length} users + memberships (invited, no password)`);
  console.log(`  • ${MOTIFS.length} motifs, ${HEADING_STYLES.length} heading styles`);
  console.log(`  • ${pageDefs.length} pages, ${keywords.length} keywords (4-tier), ${edges.length} link edges`);
  console.log(`  • blog slug rule = needs_confirmation (confirm against live site)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
