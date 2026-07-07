import "server-only";

/**
 * Provider-abstracted LLM client (spec: "start with one provider; keep
 * model/provider configurable").
 *
 * - `anthropic` — active when LLM_PROVIDER=anthropic (or an ANTHROPIC_API_KEY /
 *   LLM_API_KEY is present). Calls the Messages API directly over fetch — no
 *   SDK dependency needed for this surface.
 * - `stub` — the default without a key. Returns clearly-labeled placeholder
 *   output so the whole workflow is testable end-to-end. It NEVER invents
 *   facts, statistics, or citations (truthfulness guardrail applies to stubs
 *   too — placeholders are structural, not factual).
 */

import type { LlmProvider } from "@/lib/llm-catalog";

export type LlmMessage = { role: "user" | "assistant"; content: string };

export interface LlmClient {
  readonly provider: string;
  /** Single-turn completion. Returns the text of the model's reply. */
  complete(opts: {
    system: string;
    messages: LlmMessage[];
    maxTokens?: number;
  }): Promise<string>;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

class AnthropicClient implements LlmClient {
  readonly provider = "anthropic" as const;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(opts: {
    system: string;
    messages: LlmMessage[];
    maxTokens?: number;
  }): Promise<string> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: opts.messages,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    return data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
  }
}

/**
 * OpenAI-compatible chat client — serves OpenAI and xAI (Grok), which share the
 * `/v1/chat/completions` schema and Bearer auth. The only divergence is the
 * output-token field name, so it's parameterized.
 */
class OpenAiCompatClient implements LlmClient {
  constructor(
    readonly provider: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly tokenParam: "max_tokens" | "max_completion_tokens",
  ) {}

  async complete(opts: {
    system: string;
    messages: LlmMessage[];
    maxTokens?: number;
  }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: opts.system },
          ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        [this.tokenParam]: opts.maxTokens ?? 4096,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${this.provider} API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

/** Google Gemini (generateContent). Its own request/response shape + key-in-query auth. */
class GeminiClient implements LlmClient {
  readonly provider = "google" as const;
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(opts: {
    system: string;
    messages: LlmMessage[];
    maxTokens?: number;
  }): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
  }
}

class StubClient implements LlmClient {
  readonly provider = "stub" as const;

  async complete(opts: { system: string; messages: LlmMessage[] }): Promise<string> {
    // Recognize the task from the system prompt so stub output has the right
    // SHAPE (parseable downstream), while being unmistakably placeholder.
    const sys = opts.system.toLowerCase();
    if (sys.includes("topic ideas") || sys.includes("idea discovery")) {
      return JSON.stringify([
        {
          title: "[STUB] Configure an AI provider to research real topic ideas",
          angle:
            "This is placeholder output. Set ANTHROPIC_API_KEY (or LLM_API_KEY) in the environment to enable AI idea discovery grounded in this workspace's organization profile.",
          audience: "All",
          tier: 4,
          suggestedMotifs: { informative: 1 },
        },
      ]);
    }
    return [
      "<h2>AI provider not configured</h2>",
      "<p><strong>This draft is a placeholder.</strong> Spark's generation engine is provider-abstracted; no LLM API key is configured in this environment, so no real content was generated.</p>",
      "<h2>What to do</h2>",
      "<p>Add <code>ANTHROPIC_API_KEY</code> (or set <code>LLM_PROVIDER</code> + <code>LLM_API_KEY</code>) to the deployment variables and regenerate. The draft will then be grounded in the workspace's organization profile, SME profile, motif directives, and keyword strategy.</p>",
      "<h2>Guardrails that will apply</h2>",
      "<p>Generated drafts never fabricate statistics, studies, quotes, or citations; evidence-bearing claims are flagged for sourcing and block publishing until verified.</p>",
    ].join("\n");
  }
}

/**
 * Resolve the configured client. Env is read at call time (Railway vars).
 * Optional overrides come from per-workspace LLM settings (lib/llm-settings.ts):
 * an override apiKey/model wins over env; with no key anywhere, the stub runs.
 */
export function getLlm(overrides?: {
  provider?: LlmProvider | null;
  apiKey?: string | null;
  model?: string | null;
}): LlmClient {
  // The env key is Anthropic's (ANTHROPIC_API_KEY); it only applies when no
  // per-workspace override provider is given.
  const provider: LlmProvider = overrides?.provider ?? "anthropic";
  const apiKey =
    overrides?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? process.env.LLM_API_KEY;
  const model =
    overrides?.model ?? process.env.LLM_DEFAULT_MODEL ?? "claude-sonnet-4-6";
  const forceStub = (process.env.LLM_PROVIDER ?? "").toLowerCase() === "stub";
  if (!apiKey || forceStub) return new StubClient();

  switch (provider) {
    case "openai":
      return new OpenAiCompatClient(
        "openai",
        apiKey,
        model,
        "https://api.openai.com/v1",
        "max_completion_tokens",
      );
    case "xai":
      return new OpenAiCompatClient("xai", apiKey, model, "https://api.x.ai/v1", "max_tokens");
    case "google":
      return new GeminiClient(apiKey, model);
    default:
      return new AnthropicClient(apiKey, model);
  }
}
