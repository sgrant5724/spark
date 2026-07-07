/**
 * LLM provider + model catalog — shared by server (resolution, actions) and
 * client (settings form). No "server-only": safe to import in client components.
 * Model IDs verified current as of July 2026; the settings model field also
 * accepts a custom ID per provider, so this list guides without locking users in.
 */

export type LlmProvider = "anthropic" | "openai" | "xai" | "google";

export const PROVIDER_ORDER: LlmProvider[] = ["anthropic", "openai", "xai", "google"];

export const PROVIDERS: Record<
  LlmProvider,
  {
    label: string;
    keyHint: string;
    defaultModel: string;
    models: Array<{ id: string; label: string; hint: string }>;
  }
> = {
  anthropic: {
    label: "Anthropic · Claude",
    keyHint: "sk-ant-…",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", hint: "balanced" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "newest Sonnet" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8", hint: "most capable" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "fast / cheap" },
    ],
  },
  openai: {
    label: "OpenAI · GPT",
    keyHint: "sk-…",
    defaultModel: "gpt-5.5",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5", hint: "flagship" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", hint: "fast / cheap" },
    ],
  },
  xai: {
    label: "xAI · Grok",
    keyHint: "xai-…",
    defaultModel: "grok-4.3",
    models: [
      { id: "grok-4.3", label: "Grok 4.3", hint: "flagship" },
      { id: "grok-4.1-fast-non-reasoning", label: "Grok 4.1 Fast", hint: "fast" },
    ],
  },
  google: {
    label: "Google · Gemini",
    keyHint: "AIza… / API key",
    defaultModel: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", hint: "GA · agentic" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "reasoning (preview)" },
    ],
  },
};

export function isProvider(v: unknown): v is LlmProvider {
  return typeof v === "string" && v in PROVIDERS;
}

/** Provider-tinted accents for the UI (keeps the brand family, no green). */
export const PROVIDER_TINT: Record<LlmProvider, string> = {
  anthropic: "#C4571C", // orange
  openai: "#0D5A84", // primary blue
  xai: "#0A3A56", // deep nav
  google: "#1A7AAB", // bright blue
};
