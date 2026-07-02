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

export type LlmMessage = { role: "user" | "assistant"; content: string };

export interface LlmClient {
  readonly provider: "anthropic" | "stub";
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

/** Resolve the configured client. Env is read at call time (Railway vars). */
export function getLlm(): LlmClient {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const model = process.env.LLM_DEFAULT_MODEL ?? "claude-sonnet-4-6";
  if (apiKey && provider !== "stub") {
    return new AnthropicClient(apiKey, model);
  }
  return new StubClient();
}
