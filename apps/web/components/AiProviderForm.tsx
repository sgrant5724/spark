"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { PROVIDERS, PROVIDER_TINT, type LlmProvider } from "@/lib/llm-catalog";
import { saveLlmProvider } from "@/app/w/[workspace]/settings/llm-actions";

type SlotView = { provider: LlmProvider; label: string; last4: string } | null;

/**
 * Active-key + model picker. Choosing the active key sets the provider, which
 * swaps the model suggestions and (unless the user typed a custom ID) resets the
 * model to that provider's default. The model field is free-text with a
 * per-provider datalist, so custom / newer model IDs are allowed.
 */
export function AiProviderForm({
  slug,
  slots,
  activeSlot,
  activeProvider,
  model,
  envKeyPresent,
  canManage,
}: {
  slug: string;
  slots: SlotView[];
  activeSlot: number;
  activeProvider: LlmProvider;
  model: string;
  envKeyPresent: boolean;
  canManage: boolean;
}) {
  const [slot, setSlot] = useState(activeSlot);
  const [provider, setProvider] = useState<LlmProvider>(activeProvider);
  const [modelVal, setModelVal] = useState(model);

  function pick(nextSlot: number, nextProvider: LlmProvider) {
    setSlot(nextSlot);
    setProvider(nextProvider);
    // If the current model isn't in the new provider's catalog, reset to its
    // default (keeps a genuinely custom ID only when it already matches).
    if (!PROVIDERS[nextProvider].models.some((m) => m.id === modelVal)) {
      setModelVal(PROVIDERS[nextProvider].defaultModel);
    }
  }

  return (
    <form
      action={saveLlmProvider}
      className="mb-5 rounded-lg border border-paper bg-paper/40 p-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="activeSlot" value={slot} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60">
            Active API key
          </legend>
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="__slot"
                checked={slot === 0}
                onChange={() => pick(0, "anthropic")}
                disabled={!canManage}
                className="accent-blue"
              />
              <span className="text-ink/80">
                Deployment key (env · Anthropic){" "}
                {envKeyPresent ? (
                  <span className="text-accent">· set</span>
                ) : (
                  <span className="text-accent-warn">· not set</span>
                )}
              </span>
            </label>
            {slots.map((s, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="__slot"
                  checked={slot === i + 1}
                  onChange={() => s && pick(i + 1, s.provider)}
                  disabled={!canManage || !s}
                  className="accent-blue"
                />
                <span className={s ? "text-ink/80" : "text-ink/40"}>
                  {s ? (
                    <>
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ background: PROVIDER_TINT[s.provider] }}
                      />
                      {PROVIDERS[s.provider].label} · {s.label} ·{" "}
                      <span className="font-mono">…{s.last4}</span>
                    </>
                  ) : (
                    `Slot ${i + 1} · empty`
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60">
            Model{" "}
            <span className="font-mono normal-case text-ink/40">
              ({PROVIDERS[provider].label})
            </span>
          </span>
          <input
            name="model"
            value={modelVal}
            onChange={(e) => setModelVal(e.target.value)}
            list="llm-model-options"
            placeholder={PROVIDERS[provider].defaultModel}
            disabled={!canManage}
            className="w-full rounded-lg border border-line px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-accent disabled:bg-paper"
          />
          <datalist id="llm-model-options">
            {PROVIDERS[provider].models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </datalist>
          <span className="mt-1 block text-[0.62rem] text-ink/50">
            Pick a suggestion or type any {PROVIDERS[provider].label} model ID.
          </span>
        </label>
      </div>
      {canManage && (
        <div className="mt-3">
          <Button type="submit" size="sm">
            Save provider &amp; model
          </Button>
        </div>
      )}
    </form>
  );
}
