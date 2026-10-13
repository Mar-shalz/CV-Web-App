import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { runTask } from "@/lib/ai";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { saveDraftRoles } from "@/lib/vault/save";
import { track } from "@/lib/analytics/server";
import { takeUpload } from "@/lib/uploads/take";
import { INLINE_MAX_BYTES, UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";

// Files up to the inline limit come in the request (the host caps bodies near 4.5MB);
// bigger ones, up to the upload limit, come as a storage path that is read and deleted.
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;

type Reply = { ok: true; roles: number; items: number; sensitiveSkipped: boolean } | { ok: false; error: string; manual?: boolean };

function fail(error: string, status = 400, manual = false) {
  return NextResponse.json<Reply>({ ok: false, error, manual }, { status });
}

/**
 * CV import: PDF, Word, a phone photo, or pasted text. The file is read in memory
 * and never stored (D-024): only the roles the user then confirms are kept.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.", 401);
  if (viewer.preview) return NextResponse.json<Reply>({ ok: true, roles: 4, items: 6, sensitiveSkipped: true });
  if (!(await allow("cv_import"))) return fail(RATE_LIMITED_MESSAGE, 429);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > INLINE_MAX_BYTES + 64 * 1024) return fail(tooBigMessage(length), 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("We couldn't read that upload. Try again.");
  }

  const text = form.get("text");
  let file = form.get("file");
  const uploadPath = form.get("upload_path");
  if (typeof uploadPath === "string" && uploadPath) {
    // Read once and deleted straight away: the CV file itself is still never kept (D-024).
    const got = await takeUpload(await createClient(), viewer.id, uploadPath);
    if ("error" in got) return fail(got.error);
    file = new File([new Uint8Array(got.bytes)], String(form.get("upload_name") ?? "cv"), { type: got.type });
  }
  let input:
    | { kind: "text"; text: string; fileHash: string }
    | { kind: "pdf"; base64: string; fileHash: string }
    | { kind: "image"; base64: string; mediaType: (typeof IMAGES)[number]; fileHash: string };

  if (typeof text === "string" && text.trim()) {
    const t = text.trim();
    if (t.length < 40) return fail("That's too short to be a CV. Paste the whole thing.");
    input = { kind: "text", text: t.slice(0, 60_000), fileHash: createHash("sha256").update(t).digest("hex") };
  } else if (file instanceof File && file.size > 0) {
    if (file.size > UPLOAD_MAX_BYTES) return fail(tooBigMessage(file.size), 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const type = file.type || (file.name.toLowerCase().endsWith(".docx") ? DOCX : "");
    if (type === "application/pdf" || bytes.subarray(0, 4).toString() === "%PDF") {
      input = { kind: "pdf", base64: bytes.toString("base64"), fileHash };
    } else if (type === DOCX || file.name.toLowerCase().endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      if (value.trim().length < 40) return fail("We couldn't find any text in that Word file. Try a PDF, or paste the text.");
      input = { kind: "text", text: value.slice(0, 60_000), fileHash };
    } else if ((IMAGES as readonly string[]).includes(type)) {
      input = { kind: "image", base64: bytes.toString("base64"), mediaType: type as (typeof IMAGES)[number], fileHash };
    } else if (file.name.toLowerCase().endsWith(".doc")) {
      return fail("Old .doc files can't be read. Save it as a PDF or .docx, or paste the text.");
    } else {
      return fail("Use a PDF, a Word file (.docx) or a photo.");
    }
  } else {
    return fail("Choose a file or paste your CV first.");
  }

  const result = await runTask("parse_cv", input, { userId: viewer.id });
  if (!result.ok) {
    return fail("We couldn't read your CV this time. You can add your roles by hand instead, it only takes a few minutes.", 422, true);
  }
  if (!result.data.is_cv) return fail("This doesn't look like a CV. Check the file, or add your roles by hand.", 422, true);

  const supabase = await createClient();
  const { roleCount, itemCount } = await saveDraftRoles(supabase, viewer.id, result.data.roles, "cv_import");

  // Fill empty profile fields only; never overwrite what the user typed.
  const p = result.data.person;
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, city, state, linkedin_url").eq("user_id", viewer.id).maybeSingle();
  const patch: Record<string, string> = {};
  if (!profile?.full_name && p.full_name) patch.full_name = p.full_name;
  if (!profile?.phone && p.phone) patch.phone = p.phone;
  if (!profile?.city && p.city) patch.city = p.city;
  if (!profile?.state && p.state) patch.state = p.state;
  if (!profile?.linkedin_url && p.linkedin_url) patch.linkedin_url = p.linkedin_url;
  if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("user_id", viewer.id);

  await track("vault_import_completed", { source_type: input.kind, roles_count: roleCount, items_count: itemCount }, viewer.id);
  const s = result.data.sensitive_found;
  const sensitiveSkipped = Boolean(s.date_of_birth || s.gender || s.state_of_origin || s.marital_status_present || s.religion_present);
  return NextResponse.json<Reply>({ ok: true, roles: roleCount, items: itemCount, sensitiveSkipped });
}
