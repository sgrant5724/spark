# Spark — web service image for Railway (pnpm monorepo + Prisma + Next.js).
# Builds the whole workspace and runs apps/web. The API is a separate service
# (add later); this image is the user-facing app.
FROM node:22-slim

# Prisma needs openssl at runtime; ca-certificates for outbound TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Copy the whole workspace and install with the committed lockfile. We keep dev
# deps because the deploy step needs the Prisma CLI + tsx (migrate / rls / seed).
COPY . .
RUN pnpm install --frozen-lockfile

# Generate the Prisma client, then build the web app. AUTH_SECRET and a
# placeholder DATABASE_URL are only needed so module-load code (auth config +
# PrismaClient construction) resolves during Next's build-time page-data
# collection. Nothing connects at build (all routes are dynamic); Railway
# injects the real values at runtime.
RUN pnpm db:generate
RUN AUTH_SECRET=build-only-not-used \
    DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    pnpm --filter @spark/web build

ENV NODE_ENV=production
# Railway injects PORT; Next `start` honours it.
EXPOSE 3000

# Apply migrations + RLS, then start the server (see scripts/railway-start.sh).
CMD ["sh", "scripts/railway-start.sh"]
