import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type AiProvider, type StopReason } from "./provider";

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
          messages: [{ role: "user", content: request.user }],
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
};
