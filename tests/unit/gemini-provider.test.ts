import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiProvider, geminiModelFor } from "@/lib/ai/gemini";
import { ProviderError } from "@/lib/ai/provider";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("Gemini provider", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("maps fast and strong tasks to Gemini models, overridable by env", () => {
    expect(geminiModelFor("claude-haiku-5-5")).toBe("gemini-3.5-flash-lite");
    expect(geminiModelFor("claude-sonnet-5-5")).toBe("gemini-3.8-flash");
    vi.stubEnv("GEMINI_MODEL", "gemini-custom");
    expect(geminiModelFor("claude-sonnet-5-5")).toBe("gemini-custom");
  });

  it("sends the key in a header, files before text, JSON mode, and reads the reply", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok({ candidates: [{ content: { parts: [{ text: '```json\n{"a":1}\n```' }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 } }),
    );
    const res = await geminiProvider.complete({ model: "claude-haiku-5-5", system: "Rules", user: "Hello", maxTokens: 100, timeoutMs: 5000, jsonSchema: { type: "object" }, attachments: [{ mediaType: "application/pdf", base64: "QUJD" }] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("test-key");
    expect((init!.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init!.body));
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe("application/pdf");
    expect(body.contents[0].parts[1].text).toBe("Hello");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.system_instruction.parts[0].text).toContain("JSON Schema");
    expect(res.text).toBe('{"a":1}');
    expect(res.stopReason).toBe("end_turn");
    expect(res.costUsd).toBe(0);
    expect(res.usage.inputTokens).toBe(10);
  });

  it("treats rate limits as transient and bad requests as fatal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 429 }));
    await expect(geminiProvider.complete({ model: "claude-haiku-5-5", system: "", user: "x", maxTokens: 10, timeoutMs: 1000, jsonSchema: {} })).rejects.toMatchObject({ kind: "transient" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await expect(geminiProvider.complete({ model: "claude-haiku-5-5", system: "", user: "x", maxTokens: 10, timeoutMs: 1000, jsonSchema: {} })).rejects.toBeInstanceOf(ProviderError);
  });

  it("moves to the next Gemini model when one is busy", async () => {
    const seen: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      seen.push(String(url));
      return seen.length === 1
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] }), { status: 200 });
    });
    const res = await geminiProvider.complete({ model: "claude-sonnet-5-5", system: "", user: "x", maxTokens: 10, timeoutMs: 1000, jsonSchema: {} });
    expect(res.text).toBe('{"ok":true}');
    expect(seen[0]).toContain("gemini-3.8-flash");
    expect(seen[1]).toContain("gemini-3.5-flash");
    expect(res.servedModel).toBe("gemini-3.5-flash");
  });

  it("keeps only grounded sources from web research", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok({ candidates: [{ content: { parts: [{ text: "notes" }] }, finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "https://a.example", title: "A" } }, { web: { uri: "https://a.example", title: "A again" } }], webSearchQueries: ["q1", "q2"] } }] }),
    );
    const res = await geminiProvider.research!({ model: "claude-sonnet-5-5", system: "", user: "x", maxTokens: 100, timeoutMs: 1000, maxSearches: 2 });
    expect(res.sources).toEqual([{ url: "https://a.example", title: "A" }]);
    expect(res.searches).toBe(2);
  });
});
