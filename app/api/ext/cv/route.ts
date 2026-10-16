import { NextResponse, type NextRequest } from "next/server";
import { extUser } from "@/lib/ext/auth";
import { extViewer } from "@/lib/ext/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { withClient } from "@/lib/supabase/server";
import { getCvById } from "@/lib/cv/data";
import { finalDoc } from "@/lib/cv/types";
import { renderPdf } from "@/lib/cv/pdf";
import { isCvStyle } from "@/lib/cv/styles";
import { demoCvDoc } from "@/lib/demo/cv-doc";

export const maxDuration = 60;

/**
 * The CV file for the browser extension (D-178), with the extension's key instead of the
 * app's cookies. Only accepted suggestions go in it; a private copy is kept for the
 * application's record, like a download from the app.
 */
export async function GET(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const cvId = request.nextUrl.searchParams.get("cvId") ?? "";
  const styleParam = request.nextUrl.searchParams.get("style");
  const style = isCvStyle(styleParam) ? styleParam : "classic";
  if (user.preview) {
    const bytes = await renderPdf(finalDoc(demoCvDoc()), {}, style);
    return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "cache-control": "private, no-store" } });
  }
  if (!/^[0-9a-f-]{36}$/.test(cvId)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const db = createAdminClient();
  const viewer = await extViewer(db, user);
  const cv = await withClient(db, () => getCvById(viewer, cvId));
  if (!cv) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  // Date of birth is never added from the extension: it needs the app's per export consent.
  const doc = { ...finalDoc(cv.doc), include: { date_of_birth: false, gender: false, state_of_origin: false } };
  const bytes = Buffer.from(await renderPdf(doc, {}, style));
  const path = `${user.id}/${cv.id}.pdf`;
  const { error } = await db.storage.from("cv-exports").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (!error && !cv.locked) await db.from("cv_versions").update({ pdf_path: path }).eq("id", cv.id).eq("user_id", user.id);
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${cv.doc.fileBase}.pdf"`, "cache-control": "private, no-store" } });
}
