# Spark

Multi-tenant content & SEO engine for **LSI Media**. Runs an end-to-end pipeline —
**ideation → SME-grounded generation → SEO → assets → accessibility → review/approval →
WordPress publishing → social distribution → analytics** — with tone driven by the
**7 Motifs™** framework, runnable manually, on a schedule, or autonomously within guardrails.

Built against `spark-capability-requirements.html` (FR-1 → FR-18). FR IDs are the
canonical reference for tickets.

---

## Decisions locked for this build

| Decision | Choice | Notes |
| --- | --- | --- |
| **Database** (Open Decision #3) | **PostgreSQL 16** | JSONB config, `tsvector` full-text search, Row-Level Security for tenant isolation. |
| **Blog URL/slug rule** (Open Decision #1) | **`needs_confirmation`** | Stored as a per-workspace setting (`seo_settings.blog_slug_rule`). The live articles use root-level `/{slug}/` while the workbook uses `/blog/{slug}/`; **confirm against the live site** before publishing, then set `root` or `blog_prefix`. |
| **Backend / frontend** | NestJS + Next.js (App Router) + Tailwind, Prisma, BullMQ+Redis, Auth.js | Per the spec defaults. |
| **This session's scope** | **Repo scaffold + full schema + seed** | No auth/UI yet (those are Epics 1–2). The data model is the deliverable to review first. |

## What's in this repo now

```
spark/
├─ apps/
│  ├─ api/            NestJS skeleton — RLS-aware PrismaService, /api/health
│  └─ web/            Next.js skeleton — brand tokens (Tailwind), Spark logo mark
├─ packages/
│  ├─ db/             Prisma schema (~30 tables), rls.sql, seed.ts  ◀ the core deliverable
│  └─ shared/         Framework-agnostic domain constants (stages, states, roles, motifs, brand)
├─ .github/workflows/ci.yml
├─ docker-compose.yml Postgres 16 + Redis 7 for local dev
└─ .env.example
```

The schema covers all spec tables: identity & tenancy, workspace config (brand kit,
heading styles, image specs, rendering profiles, motifs, motif defaults, SEO settings),
strategy & knowledge (SME profiles, keywords, pages, internal-link graph), the content
pipeline (ideas, articles, versions, citations, SEO outputs, assets, social variants),
and automation/workflow/ops (schedules, runs, jobs, automation settings, approvals,
connections, analytics snapshots, notifications, audit log).

## Auth & accounts (FR-1)

Auth.js (NextAuth v5) lives in the web app:

- **Providers:** email/password (Credentials) + Google + Microsoft Entra ID SSO. JWT sessions.
- **Invite-only:** Spark never auto-creates accounts. SSO sign-in is rejected unless a user
  with that email was already invited. Passwords are set by the invitee — never by Spark.
- **MFA:** TOTP is verified at sign-in when enabled on the account.
- **Roles:** `memberships(user, workspace, role)` drives a permission matrix
  (`can(role, permission)` in `@spark/shared`). A user can belong to many workspaces with
  different roles; the **workspace switcher** is always available.
- **Edge split:** `auth.config.ts` (edge-safe, used by `middleware.ts`) is separate from
  `auth.ts` (Node-only: Credentials + Prisma + bcrypt).

### Two server-side Prisma clients in web

- **`lib/db.ts`** — app role (RLS-enforced). For tenant **content**; use only inside `withWorkspace`.
- **`lib/identity.ts`** — schema owner (bypasses RLS). For **control-plane identity** only:
  resolving who the signed-in user is and which workspaces they belong to (inherently
  cross-workspace). Never used for tenant content.

### Activating a seeded user locally

The seed creates `sabine@lsi-media.com` (owner) and `idris@lsi-media.com` (sme) **without
passwords**. Set your own to log in (human-run, mirrors the invite-activation flow):

```bash
pnpm --filter @spark/db set-password sabine@lsi-media.com 'your-dev-password'
```

Then sign in at `/login`, land on the workspace, and try **Members → invite** (writes an
`audit_log` entry).

## Tenant isolation (RLS)

Every tenant table carries `workspace_id`. Isolation is enforced at the **database** layer:

- **`prisma/rls.sql`** enables RLS and adds a `tenant_isolation` policy on every tenant
  table, filtering rows to `app_current_workspace_id()`.
- The API connects as a **non-owner** role (`spark_app`, `APP_DATABASE_URL`) — Postgres
  subjects it to RLS. Migrations and seeds connect as the **owner** (`spark_owner`,
  `DATABASE_URL`), which bypasses RLS by design.
- Per request, the API runs `PrismaService.forWorkspace(workspaceId, fn)` which opens a
  transaction, calls `set_config('app.workspace_id', …, true)`, and runs the query. No
  query can cross workspaces — search, generation context, and analytics included.

> Prisma doesn't manage RLS, so it's a versioned SQL step applied after `prisma migrate`.

## Getting started

Prerequisites: Node ≥ 20.11, pnpm 9, Docker (for Postgres + Redis).

```bash
cp .env.example .env          # then fill in secrets (never commit .env)
docker compose up -d          # Postgres 16 + Redis 7
pnpm install

pnpm db:generate              # generate Prisma client
pnpm db:setup                 # migrate → apply RLS/FTS → seed LSI Media

# dev servers (later epics flesh these out)
pnpm dev:api                  # http://localhost:4000/api/health
pnpm dev:web                  # http://localhost:3000
```

`pnpm db:setup` runs `db:migrate` (creates tables) → `db:rls` (RLS policies + full-text
indexes) → `db:seed` (LSI Media org + workspace, the 7 motifs, brand/heading/image config,
the four-tier keyword model, pages, and the internal-link graph).

> First migration: `pnpm db:migrate` will prompt for a migration name (e.g. `init`) and
> generate `packages/db/prisma/migrations/`. In CI we use `migrate:deploy`.

## Non-negotiable guardrails (enforced as the build grows)

1. **Tenant isolation** — RLS on every tenant table; no cross-workspace access.
2. **Truthfulness** — never fabricate statistics, studies, quotes, or citations. Evidence-
   bearing claims link to a verified row in `citations` or are blocked from publish.
   Keyword `volume`/`difficulty` come only from real research integrations.
3. **Human gates by default** — nothing publishes by silence; global pause/kill switch.
4. **Accessibility both ways** — published content passes WCAG 2.1 AA; the Spark UI does too.
5. **Provider adapters** — WordPress, SEO plugins, Uniple, GSC/GA4, YouTube, Nifty behind
   interfaces with stubs so the app runs before real credentials exist.
6. **Auditability** — every state transition, AI action, edit, approval, override, and
   publish is written to `audit_log`.
7. **Secrets** — never committed; third-party OAuth tokens encrypted at rest in `connections`.

## Open decisions still to confirm with the product owner

1. **Blog URL/slug rule** — confirm `root` vs `blog_prefix` against the live site (seeded as `needs_confirmation`).
2. **Refresh model** — refresh as a new `article_versions` row on the same article (current
   default; `articles.refresh_of` self-FK also exists for the linked-record option).
3. **Uniple capabilities** — supported networks, scheduling API, media constraints, and
   whether it returns post status/engagement — before finalizing the social adapter.
4. **AI image generation** — default is image *briefs* + manual upload first; AI generation
   behind a reviewed per-workspace toggle later.
5. **Hosting & model strategy** — managed vs self-host; model tiering per content track.

## Roadmap (epics)

MVP order: **Foundations** → Workspace config (Settings M9) → SME profiles → Strategy →
Idea engine (M3) → Generation (M4) → SEO output → Assets & a11y → Approval workflow (M5) →
WordPress publish. Then V1 (multi-workspace, scheduled/autonomous, GSC/GA4, Uniple,
YouTube trends, Rank Math/Yoast, content audit) and V2 (full autonomous publish, motif
A/B, GEO mode, clusters/repurposing, AI images).

**Status:**
- ✅ Scaffold + full schema + seed.
- ✅ **Epic 1 — Foundations (FR-1):** Auth.js (email/password + Google/Microsoft SSO + MFA,
  invite-only), org/workspace/membership/roles + permission matrix, workspace switcher,
  protected `/w/[workspace]` dashboard shell, members + invite flow, audit-log writer.
- ⏭️ Next: **Epic 2 — Workspace config** (Settings screen M9 wired to brand kit, heading
  styles, image dims, motifs, SEO plugin, rendering profile).
