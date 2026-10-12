import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type AiProvider, type ProviderAttachment, type ResearchSource, type StopReason } from "./provider";

let client: Anthropic | null = null;

// Retries are lib/ai's job (one retry per call), so the SDK's own are off.
function getClient(): Anthropic {
  client ??= new Anthropic({ maxRetries: 0 });
  return client;
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError("timeout");
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError("transient");
  if (error instanceof Anthropic.RateLimitError) return new ProviderError("transient", 429);
  if (error instanceof Anthropic.InternalServerError) return new ProviderError("transient", error.status);
  if (error instanceof Anthropic.APIError) return new ProviderError("fatal", error.status ?? null);
  // Missing API key, bad configuration or a bug. Not worth a retry.
  return new ProviderError("fatal");
}

function stopReason(reason: Anthropic.StopReason | null): StopReason {
  switch (reason) {
    case "end_turn":
    case "max_tokens":
    case "refusal":
      return reason;
    case "model_context_window_exceeded":
      return "context_exceeded";
    default:
      return "other";
  }
}

/** Files first, then the text (the API reads documents and images best ahead of the question). */
function userContent(text: string, attachments: ProviderAttachment[] = []): Anthropic.ContentBlockParam[] {
  const files: Anthropic.ContentBlockParam[] = attachments.map((a) =>
    a.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } }
      : { type: "image", source: { type: "base64", media_type: a.mediaType, data: a.base64 } },
  );
  return [...files, { type: "text", text }];
}

/** Claude through the Anthropic API, with structured JSON output and a cached system prompt. */
export const anthropicProvider: AiProvider = {
  async complete(request) {
    let message: Anthropic.Message & { _request_id?: string | null };
    try {
      message = await getClient().messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userContent(request.user, request.attachments) }],
          output_config: {
            format: { type: "json_schema", schema: request.jsonSchema },
            ...(request.effort ? { effort: request.effort } : {}),
          },
        },
        { timeout: request.timeoutMs, maxRetries: 0 },
      );
    } catch (error) {
      throw toProviderError(error);
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      stopReason: stopReason(message.stop_reason),
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      requestId: message._request_id ?? null,
    };
  },

  /**
   * Web search step for the legitimacy lookup. No structured output here (it can't be
   * combined with search citations); sources come only from the search tool's own
   * result blocks, never from text the model wrote.
   */
  async research(request) {
    let message: Anthropic.Message & { _request_id?: string | null };
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: request.user }];
    const sources = new Map<string, ResearchSource>();
    let searches = 0;
    let notes = "";
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let requestId: string | null = null;

    // A server tool loop can pause; resume it at most twice.
    for (let round = 0; round < 3; round++) {
      try {
        message = await getClient().messages.create(
          {
            model: request.model,
            max_tokens: request.maxTokens,
            system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
            messages,
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: request.maxSearches }],
            output_config: { effort: "low" },
          },
          { timeout: request.timeoutMs, maxRetries: 0 },
        );
      } catch (error) {
        throw toProviderError(error);
      }
      requestId = message._request_id ?? requestId;
      usage.inputTokens += message.usage.input_tokens;
      usage.outputTokens += message.usage.output_tokens;
      usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;

      for (const block of message.content) {
        if (block.type === "server_tool_use") searches++;
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) if (r.type === "web_search_result") sources.set(r.url, { url: r.url, title: r.title });
        }
        if (block.type === "text") notes += block.text;
      }
      if (message.stop_reason !== "pause_turn") {
        return { notes, sources: [...sources.values()], stopReason: stopReason(message.stop_reason), usage, searches, requestId };
      }
      messages.push({ role: "assistant", content: message.content });
    }
    return { notes, sources: [...sources.values()], stopReason: "other", usage, searches, requestId };
  },
};
