import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { cleanSkills } from "@/lib/vault/extras";
import { runTask } from "@/lib/ai";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { saveDraftRoles, type ExistingRole } from "@/lib/vault/save";
import { track } from "@/lib/analytics/server";
import { takeUpload } from "@/lib/uploads/take";
import { pdfText } from "@/lib/uploads/pdf-text";
import { INLINE_MAX_BYTES, UPLOAD_MAX_BYTES, tooBigMessage } from "@/lib/uploads/limits";

// Files up to the inline limit come in the request (the host caps bodies near 4.5MB);
// bigger ones, up to the upload limit, come as a storage path that is read and deleted.
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;

type Reply = { ok: true; roles: number; items: number; merged: number; replaced: boolean; sensitiveSkipped: boolean } | { ok: false; error: string; manual?: boolean };

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
  if (viewer.preview) return NextResponse.json<Reply>({ ok: true, roles: 4, items: 6, merged: 0, replaced: false, sensitiveSkipped: true });
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
  const plan = form.get("plan") === "replace" ? "replace" : "add";
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
    | { kind: "pdf"; base64: string; textLayer: string | null; fileHash: string }
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
      // The exact text goes with the file (D-183); a scanned PDF is read from the file alone.
      const layer = await pdfText(bytes);
      input = { kind: "pdf", base64: bytes.toString("base64"), textLayer: layer?.text ?? null, fileHash };
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
  // A second CV (D-184): the person chose to replace what's saved, or to add to it.
  const { data: savedRows } = await supabase.from("vault_roles").select("id, kind, organisation, title, vault_items(text, source_quote)").eq("user_id", viewer.id);
  const saved: ExistingRole[] = ((savedRows ?? []) as { id: string; kind: string; organisation: string | null; title: string | null; vault_items: ExistingRole["items"] | null }[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    organisation: r.organisation,
    title: r.title,
    items: r.vault_items ?? [],
  }));
  const replace = plan === "replace" && saved.length > 0;
  const { roleCount, itemCount, mergedCount } = await saveDraftRoles(supabase, viewer.id, result.data.roles, "cv_import", replace ? [] : saved);
  if (replace) {
    // Only once the new CV's roles are saved, so a failed save never leaves the person with nothing.
    if (!roleCount && result.data.roles.length) return fail("We couldn't save this CV's roles, so nothing was replaced. Try again.", 500);
    await supabase.from("vault_roles").delete().eq("user_id", viewer.id).in("id", saved.map((r) => r.id));
    // Items saved without a role (from the story interview) go too.
    await supabase.from("vault_items").delete().eq("user_id", viewer.id).is("role_id", null);
  }

  // Profile details: a replace takes this CV's details where it has them; otherwise only
  // empty fields are filled, never overwriting what the user typed.
  const p = result.data.person;
  const { data: profileRow } = await supabase.from("profiles").select("*").eq("user_id", viewer.id).maybeSingle();
  const profile = (profileRow ?? {}) as Record<string, string | null>;
  const patch: Record<string, string> = {};
  const take = (key: string, value: string | null) => {
    if (value && (replace || !profile[key]) && key in profile) patch[key] = value;
  };
  take("full_name", p.full_name);
  take("phone", p.phone);
  take("city", p.city);
  take("state", p.state);
  take("linkedin_url", p.linkedin_url);
  const web = (u: string | null) => (u && /^https?:\/\/\S+\.\S+$/i.test(u) ? u : null);
  take("portfolio_url", web(p.portfolio_url));
  take("website_url", web(p.website_url));
  if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("user_id", viewer.id);

  // The CV's own summary, skills and referees (D-162), once the round 20 columns exist.
  // Replace: this CV's take their place (skills added while checking jobs stay, D-184).
  // Add: a summary fills an empty one, skills join the list, new referees join up to four.
  const extra = (profileRow ?? {}) as Record<string, unknown>;
  if ("skills" in extra) {
    const d = result.data;
    const more: Record<string, unknown> = {};
    const oldSkills = (extra.skills as string[] | null) ?? [];
    const oldRefs = (extra.referees as { name?: string }[] | null) ?? [];
    if (replace) {
      more.summary = d.summary?.trim().slice(0, 1500) || null;
      more.skills = cleanSkills(d.skills);
      more.referees = d.referees.slice(0, 4);
    } else {
      if (!extra.summary && d.summary?.trim()) more.summary = d.summary.trim().slice(0, 1500);
      const skills = cleanSkills([...oldSkills, ...d.skills]);
      if (skills.length !== oldSkills.length) more.skills = skills;
      const known = new Set(oldRefs.map((r) => (r.name ?? "").toLowerCase().trim()));
      const newRefs = d.referees.filter((r) => !known.has(r.name.toLowerCase().trim()));
      if (newRefs.length && oldRefs.length < 4) more.referees = [...oldRefs, ...newRefs].slice(0, 4);
    }
    if (Object.keys(more).length) await supabase.from("profiles").update(more).eq("user_id", viewer.id);
  }

  await track("vault_import_completed", { source_type: input.kind, roles_count: roleCount, items_count: itemCount }, viewer.id);
  const s = result.data.sensitive_found;
  const sensitiveSkipped = Boolean(s.date_of_birth || s.gender || s.state_of_origin || s.marital_status_present || s.religion_present);
  return NextResponse.json<Reply>({ ok: true, roles: roleCount, items: itemCount, merged: mergedCount, replaced: replace, sensitiveSkipped });
}
