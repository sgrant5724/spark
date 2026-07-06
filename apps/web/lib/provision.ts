import "server-only";
import { Prisma } from "@spark/db";
import { identity } from "@/lib/identity";

/**
 * Provision a brand-new client workspace with sensible defaults — the in-app
 * equivalent of the seed's per-workspace setup. Privileged, cross-tenant admin
 * operation: runs through the OWNER (identity) client, which bypasses RLS, and
 * must only be called from an owner-gated action.
 *
 * Creates the Organization + Workspace + the creator's owner Membership, plus the
 * config every workspace expects (brand kit, heading styles, image spec, SEO
 * settings, rendering profile, the 7 Motifs, motif defaults, automation
 * settings). Client-specific CONTENT (keywords, pages, ideas, articles) is left
 * empty — a new client starts from a clean slate.
 *
 * NOTE: the default constants below are intentionally kept in sync with
 * packages/db/prisma/seed.ts. If the seed defaults change, update these too.
 */

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

const BRAND_FONTS = { ui: "Quicksand", display: "Kollektif, Quicksand" } as const;

const MOTIFS: Array<{ key: string; name: string; directive: Prisma.InputJsonValue }> = [
  { key: "visionary", name: "Visionary", directive: { voice: "Bold, future-facing, big-picture", bestFit: "Trend pieces, AI-search/GEO, 'state of' articles", evidence: "Forward-looking analysis grounded in cited signals", cta: "See what's next / book a strategy call" } },
  { key: "competitive", name: "Competitive", directive: { voice: "Direct, comparative, confident", bestFit: "'Why choose / vs.' buyer guides", evidence: "Feature/price/benefit comparisons against alternatives", cta: "Compare us / get a quote" } },
  { key: "succinct", name: "Succinct", directive: { voice: "Tight, scannable, answer-first", bestFit: "How-to, checklists, FAQs", evidence: "Essential information upfront; no hunting", cta: "Get the checklist" } },
  { key: "sincere", name: "Sincere", directive: { voice: "Warm, candid, problem-led", bestFit: "Nonprofit content, pain-point explainers", evidence: "Authentic focus on real pain points over selling", cta: "Let's talk through it" } },
  { key: "exclusive", name: "Exclusive", directive: { voice: "Insider, premium", bestFit: "Case studies, gated guides", evidence: "VIP, insider framing that makes the reader feel significant", cta: "Request access" } },
  { key: "social", name: "Social", directive: { voice: "Inclusive, values-driven", bestFit: "Community, mission, association content", evidence: "Shared values; invites the reader to 'join'", cta: "Join the conversation" } },
  { key: "informative", name: "Informative", directive: { voice: "Consultative, evidence-based", bestFit: "Cornerstone guides, Section 508 / WCAG, capability statements", evidence: "Educational, source-backed, consultative", cta: "See our services" } },
];

const HEADING_STYLES = [
  { level: 1, fontPx: 40, marginTopPx: 0, marginBottomPx: 16 },
  { level: 2, fontPx: 30, marginTopPx: 28, marginBottomPx: 10 },
  { level: 3, fontPx: 22, marginTopPx: 20, marginBottomPx: 8 },
  { level: 4, fontPx: 18, marginTopPx: 16, marginBottomPx: 6 },
  { level: 5, fontPx: 16, marginTopPx: 14, marginBottomPx: 6 },
  { level: 6, fontPx: 14, marginTopPx: 12, marginBottomPx: 6 },
];

const AVADA_ELEMENT_MAP = {
  checklist: "fusion_checklist",
  callout: "fusion_content_box",
  note: "fusion_alert",
  quote: "fusion_pullquote",
  faq: "fusion_toggle",
  cta: "fusion_button",
  section_break: "fusion_separator",
} as const;

const MOTIF_DEFAULTS: Array<{
  tier: number | null;
  audience: string | null;
  channel: string | null;
  motifMix: Prisma.InputJsonValue;
}> = [
  { tier: null, audience: null, channel: "social", motifMix: { social: 1 } },
  { tier: 2, audience: "Commercial", channel: null, motifMix: { competitive: 0.6, succinct: 0.4 } },
  { tier: 4, audience: "Nonprofit", channel: null, motifMix: { sincere: 0.6, informative: 0.4 } },
];

export async function provisionWorkspace(opts: {
  name: string;
  slug: string;
  ownerUserId: string;
}): Promise<{ workspaceId: string }> {
  const { name, slug, ownerUserId } = opts;

  return identity.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, slug } });
    const workspace = await tx.workspace.create({
      data: { name, slug, organizationId: org.id, status: "active" },
    });
    const workspaceId = workspace.id;

    await tx.membership.create({ data: { workspaceId, userId: ownerUserId, role: "owner" } });

    await tx.brandKit.create({
      data: { workspaceId, colors: BRAND_COLORS, fonts: BRAND_FONTS, footerCredit: `Built by ${name}` },
    });
    for (const hs of HEADING_STYLES) {
      await tx.headingStyle.create({ data: { workspaceId, ...hs } });
    }
    await tx.imageSpec.create({
      data: { workspaceId, featuredW: 1920, featuredH: 1080, ogW: 1200, ogH: 630, brandOg: true, brandInbody: false },
    });
    await tx.renderingProfile.create({
      data: { workspaceId, type: "avada_fusion", isDefault: true, elementMap: AVADA_ELEMENT_MAP },
    });
    await tx.seoSettings.create({
      data: { workspaceId, plugin: "squirrly", blogSlugRule: "needs_confirmation", slugRules: { blog: "{slug}", service: "{slug}" } },
    });
    for (const [i, m] of MOTIFS.entries()) {
      await tx.motif.create({ data: { workspaceId, key: m.key, name: m.name, directive: m.directive, position: i } });
    }
    for (const md of MOTIF_DEFAULTS) {
      await tx.motifDefault.create({ data: { workspaceId, ...md } });
    }
    for (const contentType of ["cornerstone", "supporting"]) {
      await tx.automationSetting.create({
        data: {
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
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorId: ownerUserId,
        action: "workspace.provisioned",
        entityType: "workspace",
        entityId: workspaceId,
        metadata: { name, slug },
      },
    });

    return { workspaceId };
  });
}
