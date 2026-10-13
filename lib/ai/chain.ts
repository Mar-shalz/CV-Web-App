import "server-only";
import { ProviderError, type AiProvider } from "./provider";
import { anthropicProvider } from "./anthropic";
import { geminiConfigured, geminiProvider } from "./gemini";

type Named = { name: "gemini" | "anthropic"; provider: AiProvider; ready: () => boolean };

const ALL: Named[] = [
  { name: "gemini", provider: geminiProvider, ready: geminiConfigured },
  { name: "anthropic", provider: anthropicProvider, ready: () => Boolean(process.env.ANTHROPIC_API_KEY) },
];

/** AI_PROVIDERS="gemini,anthropic" sets the order; default is Gemini first, then Anthropic. */
function order(): Named[] {
  const wanted = (process.env.AI_PROVIDERS || "gemini,anthropic").split(",").map((s) => s.trim());
  return wanted.map((n) => ALL.find((p) => p.name === n)).filter((p): p is Named => Boolean(p && p.ready()));
}

/**
 * Tries each configured provider in order. A provider that fails (down, rate limited,
 * bad key) hands over to the next; a reply that fails validation does not, because
 * lib/ai retries that with the problems listed.
 */
export const chainProvider: AiProvider = {
  async complete(request) {
    let last: unknown = new ProviderError("fatal");
    for (const p of order()) {
      try {
        return await p.provider.complete(request);
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof ProviderError ? last : new ProviderError("fatal");
  },
  async research(request) {
    let last: unknown = new ProviderError("fatal");
    for (const p of order()) {
      if (!p.provider.research) continue;
      try {
        return await p.provider.research(request);
      } catch (error) {
        last = error;
      }
    }
    throw last instanceof ProviderError ? last : new ProviderError("fatal");
  },
};

export function aiConfigured(): boolean {
  return order().length > 0;
}
