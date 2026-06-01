-- CreateEnum
CREATE TYPE "role" AS ENUM ('owner', 'admin', 'strategist', 'editor', 'sme', 'client_reviewer', 'viewer');

-- CreateEnum
CREATE TYPE "workspace_status" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "rendering_type" AS ENUM ('avada_fusion', 'gutenberg', 'html');

-- CreateEnum
CREATE TYPE "seo_plugin" AS ENUM ('squirrly', 'rank_math', 'yoast');

-- CreateEnum
CREATE TYPE "blog_slug_rule" AS ENUM ('root', 'blog_prefix', 'needs_confirmation');

-- CreateEnum
CREATE TYPE "article_state" AS ENUM ('idea', 'approved_idea', 'drafting', 'draft_review', 'seo_a11y_review', 'assets_pending', 'final_approval', 'scheduled', 'published', 'distributed', 'analyzing');

-- CreateEnum
CREATE TYPE "idea_source" AS ENUM ('paa', 'alsoasked', 'workbook_gap', 'competitor', 'seasonal', 'analytics', 'youtube_trend', 'manual');

-- CreateEnum
CREATE TYPE "idea_status" AS ENUM ('discovered', 'approved', 'rejected', 'refresh');

-- CreateEnum
CREATE TYPE "page_type" AS ENUM ('hub', 'audience_landing', 'deliverable', 'trust', 'conversion', 'blog');

-- CreateEnum
CREATE TYPE "keyword_intent" AS ENUM ('informational', 'commercial', 'transactional', 'navigational');

-- CreateEnum
CREATE TYPE "asset_kind" AS ENUM ('featured', 'og', 'inbody');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('pending', 'ready', 'rejected');

-- CreateEnum
CREATE TYPE "social_platform" AS ENUM ('linkedin', 'x', 'instagram', 'facebook');

-- CreateEnum
CREATE TYPE "social_variant_status" AS ENUM ('draft', 'approved', 'scheduled', 'posted', 'failed');

-- CreateEnum
CREATE TYPE "automation_mode" AS ENUM ('manual', 'scheduled', 'autonomous');

-- CreateEnum
CREATE TYPE "connection_provider" AS ENUM ('wordpress', 'squirrly', 'rank_math', 'yoast', 'nifty', 'gsc', 'ga4', 'uniple', 'youtube', 'llm', 'slack');

-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('connected', 'disconnected', 'error');

-- CreateEnum
CREATE TYPE "approval_gate" AS ENUM ('draft_review', 'seo_a11y_review', 'assets', 'final_approval');

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'active', 'completed', 'failed', 'delayed');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'slack');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "workspace_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "email_verified" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "colors" JSONB NOT NULL DEFAULT '{}',
    "fonts" JSONB NOT NULL DEFAULT '{}',
    "logo_url" TEXT,
    "footer_credit" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heading_styles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "font_px" INTEGER NOT NULL,
    "margin_top_px" INTEGER NOT NULL,
    "margin_bottom_px" INTEGER NOT NULL,
    "font_family" TEXT,
    "font_weight" TEXT,
    "line_height" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "heading_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_specs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "featured_w" INTEGER NOT NULL DEFAULT 1920,
    "featured_h" INTEGER NOT NULL DEFAULT 1080,
    "og_w" INTEGER NOT NULL DEFAULT 1200,
    "og_h" INTEGER NOT NULL DEFAULT 630,
    "brand_og" BOOLEAN NOT NULL DEFAULT true,
    "brand_inbody" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "image_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendering_profiles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "rendering_type" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "element_map" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rendering_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motifs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directive" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "motifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motif_defaults" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "tier" INTEGER,
    "audience" TEXT,
    "channel" TEXT,
    "motif_mix" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "motif_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_settings" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "plugin" "seo_plugin" NOT NULL DEFAULT 'squirrly',
    "blog_slug_rule" "blog_slug_rule" NOT NULL DEFAULT 'needs_confirmation',
    "slug_rules" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sme_profiles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sme_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "tier" INTEGER NOT NULL,
    "phrase" TEXT NOT NULL,
    "service" TEXT,
    "audience" TEXT,
    "intent" "keyword_intent",
    "target_page_id" UUID,
    "volume" INTEGER,
    "difficulty" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "page_type" "page_type" NOT NULL,
    "primary_keyword" TEXT,
    "secondary_keywords" JSONB NOT NULL DEFAULT '[]',
    "suggested_h1" TEXT,
    "suggested_title" TEXT,
    "suggested_meta" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_links" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "from_page_id" UUID NOT NULL,
    "to_page_id" UUID NOT NULL,
    "anchor_text" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "source" "idea_source" NOT NULL,
    "score" DOUBLE PRECISION,
    "tier" INTEGER,
    "audience" TEXT,
    "target_page_id" UUID,
    "suggested_motifs" JSONB NOT NULL DEFAULT '{}',
    "status" "idea_status" NOT NULL DEFAULT 'discovered',
    "dedupe_of" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "idea_id" UUID,
    "title" TEXT NOT NULL,
    "state" "article_state" NOT NULL DEFAULT 'drafting',
    "tier" SMALLINT,
    "audience" TEXT,
    "motif_mix" JSONB NOT NULL DEFAULT '{}',
    "sme_profile_id" UUID,
    "body" TEXT,
    "wordpress_post_id" BIGINT,
    "published_url" TEXT,
    "refresh_of" UUID,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "motif_mix" JSONB NOT NULL DEFAULT '{}',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "claim_text" TEXT NOT NULL,
    "source_url" TEXT,
    "source_title" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_outputs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "slug" TEXT,
    "title" TEXT,
    "title_fallback" TEXT,
    "meta" TEXT,
    "focus_keyword" TEXT,
    "secondary_keywords" JSONB NOT NULL DEFAULT '[]',
    "canonical" TEXT,
    "og_title" TEXT,
    "og_desc" TEXT,
    "internal_links" JSONB NOT NULL DEFAULT '[]',
    "publisher_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seo_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "kind" "asset_kind" NOT NULL,
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" TEXT,
    "decorative" BOOLEAN NOT NULL DEFAULT false,
    "status" "asset_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_variants" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "platform" "social_platform" NOT NULL,
    "body" TEXT,
    "image_asset_id" UUID,
    "motif" TEXT,
    "scheduled_at" TIMESTAMPTZ,
    "uniple_post_id" TEXT,
    "status" "social_variant_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "social_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "content_track" TEXT NOT NULL,
    "cadence" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "mode" "automation_mode" NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'queued',
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "logs" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID,
    "queue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "mode" "automation_mode" NOT NULL DEFAULT 'manual',
    "auto_publish" BOOLEAN NOT NULL DEFAULT false,
    "spend_cap" DECIMAL(10,2),
    "max_auto_publish" INTEGER NOT NULL DEFAULT 0,
    "quiet_hours" JSONB NOT NULL DEFAULT '{}',
    "global_pause" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "gate" "approval_gate" NOT NULL,
    "reviewer_id" UUID,
    "decision" "approval_decision",
    "reason" TEXT,
    "decided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" "connection_provider" NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'disconnected',
    "credentials" JSONB,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "position" DOUBLE PRECISION,
    "sessions" INTEGER,
    "conversions" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL DEFAULT 'in_app',
    "recipient_id" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_organization_id_idx" ON "workspaces"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_workspace_id_user_id_key" ON "memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_workspace_id_key" ON "brand_kits"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "heading_styles_workspace_id_level_key" ON "heading_styles"("workspace_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "image_specs_workspace_id_key" ON "image_specs"("workspace_id");

-- CreateIndex
CREATE INDEX "rendering_profiles_workspace_id_idx" ON "rendering_profiles"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "motifs_workspace_id_key_key" ON "motifs"("workspace_id", "key");

-- CreateIndex
CREATE INDEX "motif_defaults_workspace_id_idx" ON "motif_defaults"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_settings_workspace_id_key" ON "seo_settings"("workspace_id");

-- CreateIndex
CREATE INDEX "sme_profiles_workspace_id_idx" ON "sme_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "keywords_workspace_id_idx" ON "keywords"("workspace_id");

-- CreateIndex
CREATE INDEX "keywords_target_page_id_idx" ON "keywords"("target_page_id");

-- CreateIndex
CREATE INDEX "pages_workspace_id_idx" ON "pages"("workspace_id");

-- CreateIndex
CREATE INDEX "page_links_workspace_id_idx" ON "page_links"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_links_from_page_id_to_page_id_key" ON "page_links"("from_page_id", "to_page_id");

-- CreateIndex
CREATE INDEX "ideas_workspace_id_idx" ON "ideas"("workspace_id");

-- CreateIndex
CREATE INDEX "ideas_status_idx" ON "ideas"("status");

-- CreateIndex
CREATE INDEX "articles_workspace_id_idx" ON "articles"("workspace_id");

-- CreateIndex
CREATE INDEX "articles_state_idx" ON "articles"("state");

-- CreateIndex
CREATE INDEX "article_versions_workspace_id_idx" ON "article_versions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_versions_article_id_version_key" ON "article_versions"("article_id", "version");

-- CreateIndex
CREATE INDEX "citations_workspace_id_idx" ON "citations"("workspace_id");

-- CreateIndex
CREATE INDEX "citations_article_id_idx" ON "citations"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_outputs_article_id_key" ON "seo_outputs"("article_id");

-- CreateIndex
CREATE INDEX "seo_outputs_workspace_id_idx" ON "seo_outputs"("workspace_id");

-- CreateIndex
CREATE INDEX "assets_workspace_id_idx" ON "assets"("workspace_id");

-- CreateIndex
CREATE INDEX "assets_article_id_idx" ON "assets"("article_id");

-- CreateIndex
CREATE INDEX "social_variants_workspace_id_idx" ON "social_variants"("workspace_id");

-- CreateIndex
CREATE INDEX "social_variants_article_id_idx" ON "social_variants"("article_id");

-- CreateIndex
CREATE INDEX "schedules_workspace_id_idx" ON "schedules"("workspace_id");

-- CreateIndex
CREATE INDEX "runs_workspace_id_idx" ON "runs"("workspace_id");

-- CreateIndex
CREATE INDEX "jobs_workspace_id_idx" ON "jobs"("workspace_id");

-- CreateIndex
CREATE INDEX "jobs_run_id_idx" ON "jobs"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_settings_workspace_id_content_type_key" ON "automation_settings"("workspace_id", "content_type");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_idx" ON "approvals"("workspace_id");

-- CreateIndex
CREATE INDEX "approvals_article_id_idx" ON "approvals"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "connections_workspace_id_provider_key" ON "connections"("workspace_id", "provider");

-- CreateIndex
CREATE INDEX "analytics_snapshots_workspace_id_idx" ON "analytics_snapshots"("workspace_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_article_id_idx" ON "analytics_snapshots"("article_id");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_idx" ON "audit_log"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heading_styles" ADD CONSTRAINT "heading_styles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_specs" ADD CONSTRAINT "image_specs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendering_profiles" ADD CONSTRAINT "rendering_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motifs" ADD CONSTRAINT "motifs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motif_defaults" ADD CONSTRAINT "motif_defaults_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_settings" ADD CONSTRAINT "seo_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sme_profiles" ADD CONSTRAINT "sme_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_from_page_id_fkey" FOREIGN KEY ("from_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_to_page_id_fkey" FOREIGN KEY ("to_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_dedupe_of_fkey" FOREIGN KEY ("dedupe_of") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sme_profile_id_fkey" FOREIGN KEY ("sme_profile_id") REFERENCES "sme_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_refresh_of_fkey" FOREIGN KEY ("refresh_of") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_outputs" ADD CONSTRAINT "seo_outputs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_outputs" ADD CONSTRAINT "seo_outputs_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_variants" ADD CONSTRAINT "social_variants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_variants" ADD CONSTRAINT "social_variants_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
