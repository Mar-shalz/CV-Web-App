import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getSpeechProvider } from "@/lib/speech";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { getVault } from "@/lib/vault/data";
import { isPreviewMode } from "@/lib/env";
import { polishSpoken } from "@/lib/vault/polish";

const PREVIEW_TRANSCRIPT = "During my SIWES at the bank I opened about fifteen customer accounts a day, and I helped the head teller balance the cash at close of business.";

// 2 minutes of speech at our recording bitrate is well under 1MB.
const MAX_BYTES = 2 * 1024 * 1024;

/** Transcribes one voice answer. The audio lives only in this request's memory and is never written anywhere. */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  const provider = getSpeechProvider();
  if (!provider) {
    // Local preview only: a sample transcript so the voice flow can be reviewed without a provider.
    if (isPreviewMode()) {
      const form = await request.formData().catch(() => null);
      if (form?.get("polish") === "achievement") return NextResponse.json({ ok: true, text: "Opened about 15 customer accounts a day during SIWES at the bank, and helped the head teller balance the cash at close of business.", spoken: PREVIEW_TRANSCRIPT, polished: true });
      return NextResponse.json({ ok: true, text: PREVIEW_TRANSCRIPT });
    }
    return NextResponse.json({ ok: false, error: "Voice answers aren't switched on yet. Type your answer instead." }, { status: 501 });
  }
  if (!(await allow("interview"))) return NextResponse.json({ ok: false, error: RATE_LIMITED_MESSAGE }, { status: 429 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ ok: false, error: "We didn't get any audio. Try recording again." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "That recording is too long. Keep it under 2 minutes." }, { status: 413 });

  // Organisation names help the recogniser with Nigerian employers and places.
  const vault = await getVault(viewer);
  const vocabulary = [...new Set(vault.roles.flatMap((r) => [r.organisation, r.location]).filter((v): v is string => Boolean(v)))].slice(0, 50);

  let bytes: Buffer | null = Buffer.from(await audio.arrayBuffer());
  try {
    const { text } = await provider.transcribe(bytes, { mimeType: audio.type || "audio/webm", language: "en", vocabulary });
    bytes = null;
    // Achievements: tidied into a clear line first (D-125). What they said is sent too, so they can switch back.
    if (form.get("polish") === "achievement") {
      const roleId = String(form.get("role_id") ?? "");
      const role = vault.roles.find((r) => r.id === roleId);
      const roleLine = role ? [role.title, role.organisation].filter(Boolean).join(" at ") || null : String(form.get("role") ?? "").slice(0, 200) || null;
      const tidy = await polishSpoken(text, roleLine, viewer.id);
      return NextResponse.json({ ok: true, text: tidy.text, spoken: text, polished: tidy.polished });
    }
    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json({ ok: false, error: "We couldn't hear that clearly. Try again somewhere quieter, or type your answer." }, { status: 502 });
  } finally {
    bytes = null;
  }
}
