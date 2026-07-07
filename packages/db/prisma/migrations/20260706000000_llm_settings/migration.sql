-- CreateTable
CREATE TABLE "llm_settings" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "active_slot" INTEGER NOT NULL DEFAULT 0,
    "keys" JSONB NOT NULL DEFAULT '[null,null,null,null]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "llm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_settings_workspace_id_key" ON "llm_settings"("workspace_id");

-- AddForeignKey
ALTER TABLE "llm_settings" ADD CONSTRAINT "llm_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation: RLS policy matching prisma/rls.sql conventions. rls.sql is
-- also re-run after migrate, but applying here keeps a fresh migrate safe.
CREATE OR REPLACE FUNCTION app_current_workspace_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '')::uuid
$$;

ALTER TABLE "llm_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "llm_settings";
CREATE POLICY tenant_isolation ON "llm_settings"
  USING (workspace_id = app_current_workspace_id())
  WITH CHECK (workspace_id = app_current_workspace_id());
