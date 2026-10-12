import "server-only";

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
 * The provider is chosen after the G4 benchmark (a global provider against at least
 * one Nigeria tuned provider). Until then voice answers are switched off and the
 * interview runs on typed answers.
 */
export function getSpeechProvider(): SpeechProvider | null {
  switch (process.env.SPEECH_PROVIDER) {
    default:
      return null;
  }
}

export function voiceEnabled(): boolean {
  return getSpeechProvider() !== null;
}
