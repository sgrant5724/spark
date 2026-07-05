-- FR-14: shield high-performing posts from disruptive rewrites.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "protected_from_rewrite" BOOLEAN NOT NULL DEFAULT false;
