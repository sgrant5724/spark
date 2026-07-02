-- CreateTable
CREATE TABLE "org_profiles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "services" JSONB NOT NULL DEFAULT '[]',
    "audiences" JSONB NOT NULL DEFAULT '[]',
    "differentiators" TEXT,
    "credentials" TEXT,
    "tone_notes" TEXT,
    "website_url" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "org_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_profiles_workspace_id_key" ON "org_profiles"("workspace_id");

-- AddForeignKey
ALTER TABLE "org_profiles" ADD CONSTRAINT "org_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation: RLS policy matching prisma/rls.sql conventions. rls.sql is
-- also re-run on every deploy, but applying here keeps a fresh migrate safe.
-- Ensure the helper exists (migrations run before rls.sql on a fresh DB).
CREATE OR REPLACE FUNCTION app_current_workspace_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
$$;

ALTER TABLE "org_profiles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "org_profiles";
CREATE POLICY tenant_isolation ON "org_profiles"
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());
