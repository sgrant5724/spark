"use server";

import { revalidatePath } from "next/cache";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { encryptJson } from "@/lib/crypto";
import { WpRestAdapter, type WpCredentials } from "@/lib/wordpress";
import { can } from "@spark/shared";

/**
 * Connect a WordPress site (FR-11). Credentials are an Application Password
 * created BY the site owner in wp-admin (Users → Profile) — Spark never creates
 * accounts or passwords. Stored AES-256-GCM-encrypted in `connections`.
 */
export async function connectWordPress(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("Only owners/admins can manage integrations.");
  }
  const workspaceId = membership.workspaceId;

  const siteUrl = String(formData.get("siteUrl") ?? "").trim().replace(/\/+$/, "");
  const username = String(formData.get("username") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim();
  if (!/^https?:\/\//.test(siteUrl) || !username || !appPassword) {
    throw new Error("Site URL (https), username, and application password are required.");
  }

  const creds: WpCredentials = { siteUrl, username, appPassword };
  const check = await new WpRestAdapter(creds).verify();

  await withWorkspace(db, workspaceId, (tx) =>
    tx.connection.upsert({
      where: { workspaceId_provider: { workspaceId, provider: "wordpress" } },
      update: {
        credentials: encryptJson(creds) as unknown as Prisma.InputJsonValue,
        status: check.ok ? "connected" : "error",
        config: { siteUrl, detail: check.detail } as Prisma.InputJsonValue,
      },
      create: {
        workspaceId,
        provider: "wordpress",
        credentials: encryptJson(creds) as unknown as Prisma.InputJsonValue,
        status: check.ok ? "connected" : "error",
        config: { siteUrl, detail: check.detail } as Prisma.InputJsonValue,
      },
    }),
  );

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: check.ok ? "connection.wordpress.connected" : "connection.wordpress.failed",
    entityType: "connection",
    metadata: { siteUrl, detail: check.detail },
  });
  revalidatePath(`/w/${slug}/settings`);
}

export async function disconnectWordPress(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("Only owners/admins can manage integrations.");
  }
  const workspaceId = membership.workspaceId;
  await withWorkspace(db, workspaceId, (tx) =>
    tx.connection.deleteMany({ where: { workspaceId, provider: "wordpress" } }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "connection.wordpress.disconnected",
    entityType: "connection",
  });
  revalidatePath(`/w/${slug}/settings`);
}
