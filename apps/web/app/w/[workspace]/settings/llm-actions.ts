"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { can } from "@spark/shared";
import { encryptJson } from "@/lib/crypto";
import { KEY_SLOTS, MODEL_OPTIONS, type KeySlot } from "@/lib/llm-settings";

/**
 * AI Provider settings actions. workspace.manage gated (owner/admin). Keys are
 * write-only: encrypted at rest (AES-GCM), never echoed back, never audited —
 * audit rows carry only slot number, label, and last4.
 */

async function requireManager(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "workspace.manage")) {
    throw new Error("You don't have permission to change workspace settings.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

const fail = (slug: string, msg: string): never =>
  redirect(`/w/${slug}/settings?error=${encodeURIComponent(msg)}`);

function readSlots(keys: unknown): KeySlot[] {
  const arr = Array.isArray(keys) ? keys : [];
  return Array.from({ length: KEY_SLOTS }, (_, i) => (arr[i] as KeySlot) ?? null);
}

/** Save the model choice and which key is active (0 = deployment env key). */
export async function saveLlmProvider(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const model = String(formData.get("model") ?? "");
  const activeSlot = parseInt(String(formData.get("activeSlot") ?? "0"), 10);

  if (!MODEL_OPTIONS.some((m) => m.id === model)) fail(slug, "Pick a model from the list.");
  if (!Number.isInteger(activeSlot) || activeSlot < 0 || activeSlot > KEY_SLOTS) {
    fail(slug, "Invalid key selection.");
  }

  let err: string | null = null;
  await withWorkspace(db, workspaceId, async (tx) => {
    const row = await tx.llmSettings.findUnique({ where: { workspaceId } });
    if (activeSlot >= 1 && !readSlots(row?.keys)[activeSlot - 1]) {
      err = `Key slot ${activeSlot} is empty — save a key there first, or choose the deployment key.`;
      return;
    }
    await tx.llmSettings.upsert({
      where: { workspaceId },
      update: { model, activeSlot },
      create: { workspaceId, model, activeSlot },
    });
  });
  if (err) fail(slug, err);

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "llm.settings_changed",
    entityType: "workspace",
    entityId: workspaceId,
    metadata: { model, activeSlot },
  });
  revalidatePath(`/w/${slug}/settings`);
}

/** Save (or replace) an API key in a slot. The key is encrypted before write. */
export async function saveLlmKey(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const slot = parseInt(String(formData.get("slot") ?? ""), 10);
  const label = String(formData.get("label") ?? "").trim() || `Key ${slot}`;
  const key = String(formData.get("key") ?? "").trim();

  if (!Number.isInteger(slot) || slot < 1 || slot > KEY_SLOTS) fail(slug, "Invalid key slot.");
  if (!key) fail(slug, "Paste an API key before saving.");
  if (key.length < 20) fail(slug, "That doesn't look like an API key (too short).");

  const entry: KeySlot = {
    label: label.slice(0, 40),
    last4: key.slice(-4),
    enc: encryptJson({ key }),
  };

  await withWorkspace(db, workspaceId, async (tx) => {
    const row = await tx.llmSettings.findUnique({ where: { workspaceId } });
    const slots = readSlots(row?.keys);
    slots[slot - 1] = entry;
    await tx.llmSettings.upsert({
      where: { workspaceId },
      update: { keys: slots as unknown as Prisma.InputJsonValue },
      create: { workspaceId, keys: slots as unknown as Prisma.InputJsonValue },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "llm.key_saved",
    entityType: "workspace",
    entityId: workspaceId,
    metadata: { slot, label: entry.label, last4: entry.last4 },
  });
  revalidatePath(`/w/${slug}/settings`);
}

/** Remove a stored key. If it was active, fall back to the deployment key. */
export async function clearLlmKey(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireManager(slug);
  const slot = parseInt(String(formData.get("slot") ?? ""), 10);
  if (!Number.isInteger(slot) || slot < 1 || slot > KEY_SLOTS) fail(slug, "Invalid key slot.");

  await withWorkspace(db, workspaceId, async (tx) => {
    const row = await tx.llmSettings.findUnique({ where: { workspaceId } });
    if (!row) return;
    const slots = readSlots(row.keys);
    slots[slot - 1] = null;
    await tx.llmSettings.update({
      where: { workspaceId },
      data: {
        keys: slots as unknown as Prisma.InputJsonValue,
        activeSlot: row.activeSlot === slot ? 0 : row.activeSlot,
      },
    });
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "llm.key_cleared",
    entityType: "workspace",
    entityId: workspaceId,
    metadata: { slot },
  });
  revalidatePath(`/w/${slug}/settings`);
}