/**
 * One-time admin activation for a fresh deploy.
 *
 * Reads BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD from the environment
 * (set as Railway variables by the operator) and sets that user's password so
 * they can sign in. This is the SAME activation the user would do via
 * `set-password` — the password is supplied by the operator, never invented by
 * Spark, and it only ever activates an EXISTING (seeded/invited) user. It never
 * creates an account, honoring the FR-1 guardrail.
 *
 * No-op when the env vars are unset, so it's safe to run on every deploy.
 * Remove BOOTSTRAP_ADMIN_PASSWORD from Railway once you've logged in.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "bootstrap-admin: BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set — skipping.",
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(
      `bootstrap-admin: no user '${email}' found (run the seed first) — skipping. Spark does not auto-create accounts.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { email },
    data: { passwordHash, emailVerified: new Date() },
  });
  console.log(`bootstrap-admin: activated login for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
