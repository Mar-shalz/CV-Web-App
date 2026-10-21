import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runTask } from "@/lib/ai";
import { EMPTY_JOB, jobSchema, type ParsedJob } from "./schema";
import { fetchJobLink } from "./fetch-link";
import { readKnownBoard } from "./boards";
import { geminiReadJobLink } from "@/lib/ai/gemini";
import { detectDestination } from "@/lib/rules/destination";
import { isPreviewMode, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP } from "@/lib/config";
import { pdfText } from "@/lib/uploads/pdf-text";

export type CaptureInput =
  | { mode: "paste"; text: string; sourceUrl?: string }
  | { mode: "link"; url: string }
  | { mode: "file"; bytes: Buffer; name: string; type: string }
  | { mode: "screenshot"; bytes: Buffer; type: string };

export type CaptureResult =
  | { ok: true; jobId: string; parsed: boolean }
  | { ok: false; error: string; fallback?: "paste" | "screenshot" };

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const todayLagos = () => new Intl.DateTimeFormat("en-CA", { timeZone: APP.timezone }).format(new Date());
const hash = (v: string | Buffer) => createHash("sha256").update(typeof v === "string" ? v.toLowerCase().replace(/\s+/g, " ").trim() : v).digest("hex");

/** A post already parsed for anyone is parsed once (Build pack: cache by post_hash). Job text holds no user data. */
async function cachedParse(postHash: string): Promise<ParsedJob | null> {
  if (!isSupabaseConfigured() || isPreviewMode() || !(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) return null;
  const { data } = await createAdminClient()
    .from("jobs")
    .select("parsed, captured_at")
    .eq("post_hash", postHash)
    .eq("parse_status", "parsed")
    .gt("captured_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .limit(1)
    .maybeSingle();
  const ok = jobSchema.safeParse(data?.parsed);
  return ok.success ? ok.data : null;
}

/**
 * Turns a paste, link, file or screenshot into a saved job. Job text is untrusted:
 * it is stored as data and only ever read by the parser. If parsing fails the job
 * is still saved and the user types the details (the manual path).
 */
export async function captureJob(supabase: SupabaseClient, userId: string, targetMarkets: string[], input: CaptureInput): Promise<CaptureResult> {
  let rawText: string | null = null;
  let sourceUrl: string | null = null;
  let imagePath: string | null = null;
  let parseInput: Parameters<typeof runTask<"parse_job">>[1] | null = null;
  const today = todayLagos();
  let postHash: string;

  switch (input.mode) {
    case "paste": {
      rawText = input.text.trim().slice(0, 40_000);
      sourceUrl = input.sourceUrl ?? null;
      postHash = hash(rawText);
      parseInput = { kind: "text", text: rawText, postHash, today };
      break;
    }
    case "link": {
      // Job boards with their own public feed first (LinkedIn, Greenhouse, Lever and others).
      const board = await readKnownBoard(input.url);
      if (board && !board.ok) return { ok: false, error: `${board.board} says this job is no longer there. It may have closed or been taken down. If you still have the advert, paste its text instead.`, fallback: "paste" };
      if (board?.ok && board.text.length >= 80) {
        sourceUrl = board.finalUrl;
        rawText = board.text.slice(0, 40_000);
        postHash = hash(rawText);
        parseInput = { kind: "text", text: rawText, postHash, today };
        break;
      }
      const res = await fetchJobLink(input.url);
      if (!res.ok && res.reason === "moved") return { ok: false, error: "That link now opens a different page, so the job has probably closed or been taken down. If you still have the advert, paste its text instead.", fallback: "paste" };
      if (res.ok) {
        sourceUrl = res.finalUrl;
        rawText = res.text;
      } else if (res.reason !== "invalid") {
        // Sites like LinkedIn block apps like ours. Google can often still open the page,
        // or find the same post elsewhere, the way ChatGPT and Claude do (D-099).
        const read = await geminiReadJobLink(input.url);
        if (!read) {
          const msg =
            res.reason === "login"
              ? "That site only shows the job to people who are signed in, and we couldn't find a public copy. Copy the job text from the page and paste it, or add a screenshot. On a laptop, our Chrome extension reads the job straight from the page, because you're already signed in there."
              : "We couldn't open that link or find a public copy of the job. Copy the job text and paste it, or add a screenshot.";
          return { ok: false, error: msg, fallback: res.reason === "login" ? "screenshot" : "paste" };
        }
        sourceUrl = input.url;
        rawText = read.text;
      } else {
        return { ok: false, error: "That doesn't look like a web link. Check it, or paste the job text instead.", fallback: "paste" };
      }
      postHash = hash(rawText);
      parseInput = { kind: "text", text: rawText, postHash, today };
      break;
    }
    case "file": {
      postHash = hash(input.bytes);
      if (input.type === "application/pdf" || input.bytes.subarray(0, 4).toString() === "%PDF") {
        // The PDF's own text (D-183): exact emails and subject lines for the parser, and the
        // post text the job check reads (payment requests, contacts), as with a paste.
        const layer = await pdfText(input.bytes);
        if (layer) {
          rawText = layer.text.slice(0, 40_000);
          postHash = hash(rawText);
        }
        // With real text, the post is read as text, like a paste: quicker (round 27).
        parseInput = rawText ? { kind: "text", text: rawText, postHash, today } : { kind: "pdf", base64: input.bytes.toString("base64"), textLayer: null, postHash, today };
      } else if (input.type === DOCX || input.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        rawText = (await mammoth.extractRawText({ buffer: input.bytes })).value.slice(0, 40_000);
        parseInput = { kind: "text", text: rawText, postHash, today };
      } else if (input.type === "text/plain" || input.name.toLowerCase().endsWith(".txt")) {
        rawText = input.bytes.toString("utf8").slice(0, 40_000);
        parseInput = { kind: "text", text: rawText, postHash, today };
      } else {
        return { ok: false, error: "Use a PDF, Word (.docx) or text file, or paste the job text." };
      }
      break;
    }
    case "screenshot": {
      const type = ["image/jpeg", "image/png", "image/webp"].includes(input.type) ? (input.type as "image/jpeg" | "image/png" | "image/webp") : null;
      if (!type) return { ok: false, error: "Use a photo or screenshot (JPEG, PNG or WebP)." };
      postHash = hash(input.bytes);
      imagePath = `${userId}/${randomUUID()}.${type.split("/")[1]}`;
      const { error } = await supabase.storage.from("job-uploads").upload(imagePath, input.bytes, { contentType: type, upsert: false });
      if (error) return { ok: false, error: "We couldn't save that screenshot. Try again." };
      parseInput = { kind: "image", base64: input.bytes.toString("base64"), mediaType: type, postHash, today };
      break;
    }
  }

  let parsed: ParsedJob | null = await cachedParse(postHash);
  if (!parsed && parseInput) {
    const res = await runTask("parse_job", parseInput, { userId });
    if (res.ok) {
      if (!res.data.is_job_post)
        return {
          ok: false,
          error:
            input.mode === "link"
              ? "That link opens a page with no job advert on it. The job may have closed, or the link may go to a list of jobs. Open it to check, or paste the job text instead."
              : "This doesn't look like a job advert. Check it and try again, or type the details yourself.",
          fallback: input.mode === "link" ? "paste" : undefined,
        };
      parsed = res.data;
    }
  }

  const job = parsed ?? EMPTY_JOB;
  const dest = detectDestination(job, targetMarkets);
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      source_type: input.mode === "screenshot" ? "screenshot" : input.mode === "link" ? "link" : "paste",
      raw_text: rawText,
      raw_image_path: imagePath,
      source_url: sourceUrl ?? (input.mode === "link" ? input.url : null),
      post_hash: postHash,
      parsed: job,
      parse_status: parsed ? "parsed" : "manual",
      destination_country: dest.country,
      destination_confidence: dest.confidence,
      destination_signals: dest.signals,
      deadline: job.deadline,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "We couldn't save this job. Check your connection and try again." };
  return { ok: true, jobId: data.id, parsed: Boolean(parsed) };
}
