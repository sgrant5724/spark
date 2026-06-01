import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Prisma, PrismaClient, withWorkspace } from "@spark/db";

/**
 * RLS-aware Prisma client.
 *
 * The API connects via APP_DATABASE_URL — a NON-OWNER role that Postgres
 * subjects to Row-Level Security (see prisma/rls.sql). Every tenant query must
 * run inside `forWorkspace`, which opens a transaction, sets the per-connection
 * `app.workspace_id`, and runs the callback. The RLS policies then restrict all
 * reads/writes to that workspace — no query can cross tenant boundaries.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run `fn` with tenant isolation pinned to `workspaceId`. set_config(...,true)
   * scopes the setting to the surrounding transaction so it never leaks across
   * pooled connections.
   */
  async forWorkspace<T>(
    workspaceId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return withWorkspace(this, workspaceId, fn);
  }
}
