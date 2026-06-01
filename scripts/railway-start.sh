#!/usr/bin/env sh
# Railway start command for the web service. Runs inside Railway, so it uses the
# internal DATABASE_URL (the owner connection) for all schema/data setup, then
# boots Next.
set -e

echo "→ Applying migrations (prisma migrate deploy)"
pnpm db:migrate:deploy

echo "→ Applying RLS policies + full-text indexes"
pnpm db:rls

# Seed only when explicitly enabled (set SEED_ON_DEPLOY=true in Railway for the
# first boot, then remove it). The seed is idempotent but re-applies LSI Media
# defaults, so we don't run it on every deploy by default.
if [ "$SEED_ON_DEPLOY" = "true" ]; then
  echo "→ Seeding workspace defaults (SEED_ON_DEPLOY=true)"
  pnpm db:seed
fi

# Activate a login from BOOTSTRAP_ADMIN_EMAIL/PASSWORD if set (your own password,
# supplied as a Railway variable). No-op when unset; never creates accounts.
echo "→ Activating admin login (if BOOTSTRAP_ADMIN_* configured)"
pnpm --filter @spark/db bootstrap-admin

echo "→ Starting web server"
exec pnpm --filter @spark/web start
