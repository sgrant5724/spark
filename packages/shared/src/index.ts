/**
 * @spark/shared — framework-agnostic domain constants shared by api & web.
 * Mirrors the requirements spec; keep in sync with the Prisma enums.
 */

// The nine pipeline stages (spec §2).
export const PIPELINE_STAGES = [
  "ideate",
  "personalize",
  "generate",
  "optimize",
  "assets",
  "review",
  "publish",
  "distribute",
  "analyze",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Article lifecycle states (spec §7) — matches Prisma `ArticleState`.
export const ARTICLE_STATES = [
  "idea",
  "approved_idea",
  "drafting",
  "draft_review",
  "seo_a11y_review",
  "assets_pending",
  "final_approval",
  "scheduled",
  "published",
  "distributed",
  "analyzing",
] as const;
export type ArticleStateName = (typeof ARTICLE_STATES)[number];

// Allowed forward transitions for the workflow state machine.
export const ARTICLE_TRANSITIONS: Record<ArticleStateName, ArticleStateName[]> = {
  idea: ["approved_idea"],
  approved_idea: ["drafting"],
  drafting: ["draft_review"],
  draft_review: ["seo_a11y_review", "drafting"],
  seo_a11y_review: ["assets_pending", "drafting"],
  assets_pending: ["final_approval"],
  final_approval: ["scheduled", "drafting"],
  scheduled: ["published"],
  published: ["distributed"],
  distributed: ["analyzing"],
  analyzing: [],
};

// Roles (spec §4) — matches Prisma `Role`.
export const ROLES = [
  "owner",
  "admin",
  "strategist",
  "editor",
  "sme",
  "client_reviewer",
  "viewer",
] as const;
export type RoleName = (typeof ROLES)[number];

// Coarse permission actions, mapped to roles per spec §4 (roles & permissions).
// Fine-grained gates (e.g. final-approval) are enforced in the workflow layer.
export const PERMISSIONS = [
  "workspace.manage", // settings, integrations, motif/prompt config
  "users.manage", // invite users, assign roles, billing
  "strategy.manage", // keywords, ideas, schedule
  "content.edit", // create/edit drafts, run generation
  "content.approve_draft", // move to draft review
  "content.approve_final", // grant final approval / publish
  "content.read", // read content & analytics
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  strategist: [
    "strategy.manage",
    "content.edit",
    "content.approve_draft",
    "content.approve_final",
    "content.read",
  ],
  editor: ["content.edit", "content.approve_draft", "content.read"],
  sme: ["content.read"], // maintains own SME profile via a dedicated scope
  client_reviewer: ["content.approve_final", "content.read"], // only assigned items, enforced at query layer
  viewer: ["content.read"],
};

/** Does `role` grant `permission`? */
export function can(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// The 7 Motifs™ keys (spec §3).
export const MOTIF_KEYS = [
  "visionary",
  "competitive",
  "succinct",
  "sincere",
  "exclusive",
  "social",
  "informative",
] as const;
export type MotifKey = (typeof MOTIF_KEYS)[number];

// Brand tokens (spec — frontend brand tokens). Single source of truth for
// Tailwind theme + CSS variables.
export const BRAND = {
  primaryBlue: "#0D5A84",
  primaryGray: "#343433",
  orange: "#C4571C",
  yellow: "#F8CF40",
  lightBlue: "#B1D4E0",
  paper: "#EFF3FA",
  deepNav: "#0A3A56",
  white: "#FFFFFF",
} as const;
