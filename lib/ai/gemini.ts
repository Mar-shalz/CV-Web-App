import "server-only";
import { ProviderError, type AiProvider, type ProviderAttachment, type ResearchSource, type StopReason } from "./provider";
import type { AiModel } from "./types";

// Google Gemini through its REST API (no SDK, so no extra dependency or bundle weight).
// Used first while the founder tests on Gemini's free tier; Anthropic stays as the
// second provider (D-068). Free tier terms let Google use prompts to improve its
// products, so test with your own or made up details until a paid tier is on.

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Our tasks name a Claude model; each maps to a Gemini model of the same class. */
export function geminiModelFor(model: AiModel): string {
  const fast = process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
  const strong = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  return model.includes("haiku") ? fast : strong;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type Part = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[]; webSearchQueries?: string[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
};

function parts(text: string, attachments: ProviderAttachment[] = []): Part[] {
  return [...attachments.map((a) => ({ inline_data: { mime_type: a.mediaType, data: a.base64 } })), { text }];
}

function stopReason(r: GeminiResponse): StopReason {
  if (r.promptFeedback?.blockReason) return "refusal";
  switch (r.candidates?.[0]?.finishReason) {
    case "STOP":
      return "end_turn";
    case "MAX_TOKENS":
      return "max_tokens";
    case "SAFETY":
    case "PROHIBITED_CONTENT":
    case "BLOCKLIST":
    case "SPII":
    case "RECITATION":
      return "refusal";
    default:
      return "other";
  }
}

async function call(model: string, body: unknown, timeoutMs: number): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ProviderError("fatal");
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // The key goes in a header, never in the URL, so it can't end up in logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "transient");
  }
  if (res.status === 429 || res.status >= 500) throw new ProviderError("transient", res.status);
  if (!res.ok) throw new ProviderError("fatal", res.status);
  return (await res.json()) as GeminiResponse;
}

const textOf = (r: GeminiResponse) =>
  (r.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

const usageOf = (r: GeminiResponse) => ({
  inputTokens: r.usageMetadata?.promptTokenCount ?? 0,
  outputTokens: (r.usageMetadata?.candidatesTokenCount ?? 0) + (r.usageMetadata?.thoughtsTokenCount ?? 0),
  cacheReadTokens: r.usageMetadata?.cachedContentTokenCount ?? 0,
  cacheWriteTokens: 0,
});

/** Free tier calls cost nothing; set GEMINI_TIER=paid once billing is on (costs then come from Google's dashboard). */
const priced = () => (process.env.GEMINI_TIER === "paid" ? undefined : 0);

export const geminiProvider: AiProvider = {
  async complete(request) {
    const model = geminiModelFor(request.model);
    // The schema goes in the instructions as well as the JSON mode: lib/ai validates every
    // reply against it and retries once with the problems, whatever the model supports.
    const system = `${request.system}\n\n## Reply format\nReply with one JSON object only, no markdown fences, that matches this JSON Schema exactly:\n${JSON.stringify(request.jsonSchema)}`;
    const r = await call(
      model,
      {
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: parts(request.user, request.attachments) }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: request.maxTokens },
      },
      request.timeoutMs,
    );
    const text = textOf(r)
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, "");
    return { text, stopReason: stopReason(r), usage: usageOf(r), requestId: null, servedModel: model, costUsd: priced() };
  },

  /** Web research with Google Search grounding; sources come only from the grounding results. */
  async research(request) {
    const model = geminiModelFor(request.model);
    const r = await call(
      model,
      {
        system_instruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.user }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: request.maxTokens },
      },
      request.timeoutMs,
    );
    const meta = r.candidates?.[0]?.groundingMetadata;
    const seen = new Set<string>();
    const sources: ResearchSource[] = [];
    for (const c of meta?.groundingChunks ?? []) {
      const url = c.web?.uri;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({ url, title: c.web?.title ?? url });
    }
    return { notes: textOf(r), sources, stopReason: stopReason(r), usage: usageOf(r), searches: meta?.webSearchQueries?.length ?? 0, requestId: null };
  },
};
