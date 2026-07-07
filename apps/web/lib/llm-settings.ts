import "server-only";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { decryptJson, type Encrypted } from "@/lib/crypto";
import { getLlm, type LlmClient } from "@/lib/llm";
import { PROVIDERS, isProvider, type LlmProvider } from "@/lib/llm-catalog";

/**
 * Per-workspace AI provider settings (llm_settings table). Up to four API-key
 * slots, each tagged with a provider and stored AES-GCM-encrypted; `activeSlot`
 * 0 = the deployment env key (Anthropic), 1-4 select a stored slot. `model` is
 * the model used for generation; the settings UI keeps it in sync with the
 * active slot's provider.
 */

export const KEY_SLOTS = 4;

export type KeySlot = {
  provider: LlmProvider;
  label: string;
  last4: string;
  enc: Encrypted;
} | null;

export type LlmSettingsView = {
  model: string;
  activeSlot: number; // 0 = env key
  activeProvider: LlmProvider;
  // never exposes ciphertext
  slots: Array<{ provider: LlmProvider; label: string; last4: string } | null>;
  envKeyPresent: boolean;
};

function parseSlots(keys: unknown): KeySlot[] {
  const arr = Array.isArray(keys) ? keys : [];
  return Array.from({ length: KEY_SLOTS }, (_, i) => {
    const s = arr[i] as KeySlot;
    return s && isProvider(s.provider) ? s : null;
  });
}

/** Provider implied by the active slot (0 = env = anthropic). */
function providerForSlot(slots: KeySlot[], activeSlot: number): LlmProvider {
  if (activeSlot >= 1 && activeSlot <= KEY_SLOTS) {
    return slots[activeSlot - 1]?.provider ?? "anthropic";
  }
  return "anthropic";
}

/** Read settings for display — ciphertext stays server-side, never in props. */
export async function getLlmSettingsView(workspaceId: string): Promise<LlmSettingsView> {
  const row = await withWorkspace(db, workspaceId, (tx) =>
    tx.llmSettings.findUnique({ where: { workspaceId } }),
  );
  const slots = parseSlots(row?.keys);
  const activeSlot = row?.activeSlot ?? 0;
  const activeProvider = providerForSlot(slots, activeSlot);
  return {
    model:
      row?.model ??
      process.env.LLM_DEFAULT_MODEL ??
      PROVIDERS[activeProvider].defaultModel,
    activeSlot,
    activeProvider,
    slots: slots.map((s) =>
      s ? { provider: s.provider, label: s.label, last4: s.last4 } : null,
    ),
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
  let provider: LlmProvider = "anthropic";
  if (row.activeSlot >= 1 && row.activeSlot <= KEY_SLOTS) {
    const slot = parseSlots(row.keys)[row.activeSlot - 1];
    if (!slot) {
      throw new Error(
        `AI key slot ${row.activeSlot} is active but empty — pick another key in Settings → AI Provider.`,
      );
    }
    provider = slot.provider;
    try {
      apiKey = decryptJson<{ key: string }>(slot.enc).key;
    } catch {
      throw new Error(
        `AI key slot ${row.activeSlot} ("${slot.label}") could not be decrypted — re-enter it in Settings → AI Provider.`,
      );
    }
  }
  return getLlm({ provider, apiKey, model: row.model });
}