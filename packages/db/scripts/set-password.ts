/**
 * Dev helper — let a user set THEIR OWN password locally (human-invoked).
 *
 *   pnpm --filter @spark/db set-password <email> <password>
 *
 * This exists only so a seeded/invited account can be activated in local dev.
 * Spark itself never sets passwords on a user's behalf (FR-1); this is run
 * manually by the account holder, not by the app.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: set-password <email> <password>");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash, emailVerified: new Date() },
  });
  console.log(`Password set for ${user.email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
