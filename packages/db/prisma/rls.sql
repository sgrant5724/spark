-- ============================================================================
-- Spark — Row-Level Security + full-text search.
--
-- Prisma does not manage RLS, so this versioned SQL step is applied AFTER
-- `prisma migrate` (see README / `pnpm db:rls`). Re-runnable (idempotent).
--
-- Isolation model
-- ---------------
-- * The API connects as a NON-OWNER role (spark_app via APP_DATABASE_URL) and,
--   per request, runs:  SET app.workspace_id = '<uuid>';  inside the txn.
-- * Every tenant policy below filters rows to that workspace. Postgres exempts
--   table OWNERS and SUPERUSERS from RLS, so migrations & seeds (spark_owner,
--   DATABASE_URL) intentionally bypass it. RLS is NOT forced for that reason.
-- ============================================================================

-- --- runtime app role -------------------------------------------------------
-- Create the least-privilege runtime role once (edit the password, or manage
-- it via your secrets manager). Safe to leave commented if you create it out
-- of band; the GRANTs below assume it exists.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'spark_app') then
    create role spark_app login password 'CHANGE_ME';
  end if;
end $$;

grant usage on schema public to spark_app;
grant select, insert, update, delete on all tables in schema public to spark_app;
grant usage, select on all sequences in schema public to spark_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to spark_app;
alter default privileges in schema public
  grant usage, select on sequences to spark_app;

-- --- current workspace helper ----------------------------------------------
create or replace function app_current_workspace_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.workspace_id', true), '')::uuid
$$;

-- --- tenant isolation policies (tables carrying workspace_id) ---------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'memberships','brand_kits','heading_styles','image_specs',
    'rendering_profiles','motifs','motif_defaults','seo_settings',
    'sme_profiles','keywords','pages','page_links','ideas','articles',
    'article_versions','citations','seo_outputs','assets','social_variants',
    'schedules','runs','jobs','automation_settings','approvals','connections',
    'analytics_snapshots','notifications','audit_log'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I '
      || 'using (workspace_id = app_current_workspace_id()) '
      || 'with check (workspace_id = app_current_workspace_id())', t);
  end loop;
end $$;

-- --- workspaces: row is its own tenant boundary (keyed by id) ----------------
alter table workspaces enable row level security;
drop policy if exists tenant_isolation on workspaces;
create policy tenant_isolation on workspaces
  using (id = app_current_workspace_id())
  with check (id = app_current_workspace_id());

-- organizations & users are global identity tables and are NOT workspace-scoped;
-- access is governed at the application/membership layer, not RLS.

-- --- full-text search (FR-4/FR-5: ideas & content search) -------------------
create index if not exists ideas_fts_idx
  on ideas using gin (to_tsvector('english', coalesce(title, '')));

create index if not exists articles_fts_idx
  on articles using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  );
