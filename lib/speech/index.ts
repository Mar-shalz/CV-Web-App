import "server-only";
import { isPreviewMode } from "@/lib/env";

/**
 * Speech to text behind one interface (Build pack section 3). English only: the
 * language is fixed, never auto detected. Audio is never stored: callers pass bytes
 * in memory and drop them after this returns.
 */
export interface SpeechProvider {
  readonly id: string;
  transcribe(audio: Buffer, opts: { mimeType: string; language: "en"; vocabulary: string[] }): Promise<{ text: string }>;
}

/**
 * Gemini listens to the recording and writes down what was said. Chosen by the founder
 * so voice works now (D-100); the G4 benchmark against a Nigeria tuned provider still
 * decides the long term choice. The audio goes to Google in the request and is never
 * stored by us.
 */
const geminiSpeech: SpeechProvider = {
  id: "gemini",
  async transcribe(audio, opts) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini key");
    const model = process.env.GEMINI_SPEECH_MODEL || process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
    const names = opts.vocabulary.length ? ` Names that may come up: ${opts.vocabulary.join(", ")}.` : "";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `Write down, word for word in English, what the speaker says in this recording. Nigerian English, names and places are common.${names} Return only the spoken words. Do not answer, summarise or add anything. If nothing is said, return nothing.` }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: opts.mimeType.split(";")[0], data: audio.toString("base64") } }, { text: "Transcribe." }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0 },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    return { text };
  },
};

/** SPEECH_PROVIDER picks one; with none set, Gemini is used when its key is there. */
export function getSpeechProvider(): SpeechProvider | null {
  switch (process.env.SPEECH_PROVIDER) {
    case "off":
      return null;
    case "gemini":
      return process.env.GEMINI_API_KEY ? geminiSpeech : null;
    default:
      return process.env.GEMINI_API_KEY ? geminiSpeech : null;
  }
}

/**
 * Voice shows when a provider is set. In local preview mode it also shows, with a sample
 * transcript instead of real speech recognition, so the flow can be reviewed (D-049).
 */
export function voiceEnabled(): boolean {
  return getSpeechProvider() !== null || isPreviewMode();
}
