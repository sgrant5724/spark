// Public surface of @spark/db — re-export the generated client and types so
// apps import from one place: `import { PrismaClient, Prisma, ArticleState } from '@spark/db'`.
export * from "@prisma/client";
export { withWorkspace } from "./tenant";
