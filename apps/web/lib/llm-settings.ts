import "server-only";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { decryptJson, type Encrypted } from "@/lib/crypto";
import { getLlm, type LlmClient } from "@/lib/llm";

/**
 * Per-workspace AI provider settings (llm_settings table). Up to four API-key
 * slots, stored AES-GCM-encrypted; `activeSlot` 0 means "use the deployment env
 * key" (ANTHROPIC_API_KEY), 1-4 selects a stored slot. `model` picks the
 * Claude model used for all generation in the workspace.
 */

export const KEY_SLOTS = 4;

/** Curated model choices (Claude API catalog, no date suffixes). */
export const MODEL_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", hint: "balanced default" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "newest Sonnet — near-Opus quality" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", hint: "most capable" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "fastest / lowest cost" },
];

export type KeySlot = {
  label: string;
  last4: string;
  enc: Encrypted;
} | null;

export type LlmSettingsView = {
  model: string;
  activeSlot: number; // 0 = env key
  slots: Array<{ label: string; last4: string } | null>; // never exposes ciphertext
  envKeyPresent: boolean;
};

function parseSlots(keys: unknown): KeySlot[] {
  const arr = Array.isArray(keys) ? keys : [];
  return Array.from({ length: KEY_SLOTS }, (_, i) => (arr[i] as KeySlot) ?? null);
}

/** Read settings for display — ciphertext stays server-side, never in props. */
export async function getLlmSettingsView(workspaceId: string): Promise<LlmSettingsView> {
  const row = await withWorkspace(db, workspaceId, (tx) =>
    tx.llmSettings.findUnique({ where: { workspaceId } }),
  );
  const slots = parseSlots(row?.keys);
  return {
    model: row?.model ?? process.env.LLM_DEFAULT_MODEL ?? "claude-sonnet-4-6",
    activeSlot: row?.activeSlot ?? 0,
    slots: slots.map((s) => (s ? { label: s.label, last4: s.last4 } : null)),
    envKeyPresent: !!(process.env.ANTHROPIC_API_KEY ?? process.env.LLM_API_KEY),
  };
}

/**
 * Resolve the LLM client for a workspace: decrypts the active key slot (if any)
 * and applies the configured model. Falls back to env configuration when no row
 * exists or the active slot points at the env key.
 */
export async function resolveLlm(workspaceId: string): Promise<LlmClient> {
  const row = await withWorkspace(db, workspaceId, (tx) =>
    tx.llmSettings.findUnique({ where: { workspaceId } }),
  );
  if (!row) return getLlm();

  let apiKey: string | null = null;
  if (row.activeSlot >= 1 && row.activeSlot <= KEY_SLOTS) {
    const slot = parseSlots(row.keys)[row.activeSlot - 1];
    if (!slot) {
      throw new Error(
        `AI key slot ${row.activeSlot} is active but empty — pick another key in Settings → AI Provider.`,
      );
    }
    try {
      apiKey = decryptJson<{ key: string }>(slot.enc).key;
    } catch {
      throw new Error(
        `AI key slot ${row.activeSlot} ("${slot.label}") could not be decrypted — re-enter it in Settings → AI Provider.`,
      );
    }
  }
  return getLlm({ apiKey, model: row.model });
}