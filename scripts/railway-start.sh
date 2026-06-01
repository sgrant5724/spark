#!/usr/bin/env sh
# Railway start command for the web service.
# Runs schema migrations + RLS as the DB owner (DATABASE_URL), then boots Next.
#
# Seeding is intentionally NOT automatic — run it once manually:
#   railway run pnpm db:seed
set -e

echo "→ Applying migrations (prisma migrate deploy)"
pnpm db:migrate:deploy

echo "→ Applying RLS policies + full-text indexes"
pnpm db:rls

echo "→ Starting web server"
exec pnpm --filter @spark/web start
