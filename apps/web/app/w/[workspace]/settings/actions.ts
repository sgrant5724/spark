"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  SeoPlugin,
  BlogSlugRule,
  RenderingType,
  withWorkspace,
} from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";

// All settings edits require workspace.manage (owner/admin). Reads/writes go
// through withWorkspace so RLS scopes them to the tenant; we also filter by
// workspaceId explicitly as defense-in-depth.
async function requireManager(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("You don't have permission to change workspace settings.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

function posInt(v: FormDataEntryValue | null, fallback: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---- Brand kit (logo + footer credit; colors are shown read-only) ----------
export async function saveBrandKit(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const footerCredit = String(formData.get("footerCredit") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.brandKit.upsert({
      where: { workspaceId },
      update: { footerCredit, logoUrl },
      create: { workspaceId, footerCredit, logoUrl },
    });
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.brand_kit.updated",
    entityType: "brand_kit",
    metadata: { footerCredit, logoUrl },
  });
  revalidatePath(`/w/${slug}/settings`);
}

// ---- Image dimensions (FR-2 / FR-8) ----------------------------------------
export async function saveImageSpec(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const data = {
    featuredW: posInt(formData.get("featuredW"), 1920),
    featuredH: posInt(formData.get("featuredH"), 1080),
    ogW: posInt(formData.get("ogW"), 1200),
    ogH: posInt(formData.get("ogH"), 630),
    brandOg: formData.get("brandOg") === "on",
    brandInbody: formData.get("brandInbody") === "on",
  };
  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.imageSpec.upsert({
      where: { workspaceId },
      update: data,
      create: { workspaceId, ...data },
    });
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.image_spec.updated",
    entityType: "image_spec",
    metadata: data,
  });
  revalidatePath(`/w/${slug}/settings`);
}

// ---- Heading styles H1–H6 (FR-2; visual only, never alters semantic order) --
export async function saveHeadingStyles(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);

  await withWorkspace(db, workspaceId, async (tx) => {
    for (let level = 1; level <= 6; level++) {
      const fontPx = parseInt(String(formData.get(`h${level}_font`) ?? ""), 10);
      const marginTopPx = parseInt(String(formData.get(`h${level}_mt`) ?? ""), 10);
      const marginBottomPx = parseInt(
        String(formData.get(`h${level}_mb`) ?? ""),
        10,
      );
      if (![fontPx, marginTopPx, marginBottomPx].every(Number.isFinite)) continue;
      await tx.headingStyle.upsert({
        where: { workspaceId_level: { workspaceId, level } },
        update: { fontPx, marginTopPx, marginBottomPx },
        create: { workspaceId, level, fontPx, marginTopPx, marginBottomPx },
      });
    }
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.heading_styles.updated",
    entityType: "heading_style",
  });
  revalidatePath(`/w/${slug}/settings`);
}

// ---- SEO plugin + blog slug rule (FR-7) ------------------------------------
export async function saveSeoSettings(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);

  const pluginRaw = String(formData.get("plugin") ?? "");
  const ruleRaw = String(formData.get("blogSlugRule") ?? "");
  const plugin = (Object.values(SeoPlugin) as string[]).includes(pluginRaw)
    ? (pluginRaw as SeoPlugin)
    : SeoPlugin.squirrly;
  const blogSlugRule = (Object.values(BlogSlugRule) as string[]).includes(ruleRaw)
    ? (ruleRaw as BlogSlugRule)
    : BlogSlugRule.needs_confirmation;

  await withWorkspace(db, workspaceId, async (tx) => {
    await tx.seoSettings.upsert({
      where: { workspaceId },
      update: { plugin, blogSlugRule },
      create: { workspaceId, plugin, blogSlugRule },
    });
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.seo.updated",
    entityType: "seo_settings",
    metadata: { plugin, blogSlugRule },
  });
  revalidatePath(`/w/${slug}/settings`);
}

// ---- Design-system rendering profile (FR-18) -------------------------------
export async function saveRenderingProfile(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);

  const typeRaw = String(formData.get("type") ?? "");
  const type = (Object.values(RenderingType) as string[]).includes(typeRaw)
    ? (typeRaw as RenderingType)
    : RenderingType.html;

  await withWorkspace(db, workspaceId, async (tx) => {
    const existing =
      (await tx.renderingProfile.findFirst({
        where: { workspaceId, isDefault: true },
      })) ??
      (await tx.renderingProfile.findFirst({ where: { workspaceId } }));
    if (existing) {
      await tx.renderingProfile.update({
        where: { id: existing.id },
        data: { type, isDefault: true },
      });
    } else {
      await tx.renderingProfile.create({
        data: { workspaceId, type, isDefault: true },
      });
    }
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.rendering_profile.updated",
    entityType: "rendering_profile",
    metadata: { type },
  });
  revalidatePath(`/w/${slug}/settings`);
}

// ---- Motif management: edit display name + voice directive (FR-2; §3) -------
export async function saveMotifs(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const ids = String(formData.get("motifIds") ?? "")
    .split(",")
    .filter(Boolean);

  await withWorkspace(db, workspaceId, async (tx) => {
    for (const id of ids) {
      const motif = await tx.motif.findFirst({ where: { id, workspaceId } });
      if (!motif) continue;
      const name = String(formData.get(`motif_${id}_name`) ?? "").trim();
      const voice = String(formData.get(`motif_${id}_voice`) ?? "").trim();
      const directive = {
        ...((motif.directive as Record<string, unknown>) ?? {}),
        voice,
      };
      await tx.motif.update({
        where: { id },
        data: {
          name: name || motif.name,
          directive: directive as Prisma.InputJsonValue,
        },
      });
    }
  });
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "settings.motifs.updated",
    entityType: "motif",
  });
  revalidatePath(`/w/${slug}/settings`);
}
