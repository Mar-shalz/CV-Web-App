import { NextResponse, after, type NextRequest } from "next/server";
import { recordDesignEvent } from "@/lib/cv/design-usage";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { getCvById } from "@/lib/cv/data";
import { renderPdf } from "@/lib/cv/pdf";
import { renderDocx } from "@/lib/cv/docx";
import { openFlags, finalDoc } from "@/lib/cv/types";
import { isCvStyle } from "@/lib/cv/styles";
import { readSensitive } from "@/lib/sensitive";
import { formatDate } from "@/lib/format";
import { track } from "@/lib/analytics/server";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Downloads a CV. Open flags never block it (they're logged). The file is sent in the
 * response; a private copy is stored for the application's record.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") === "docx" ? "docx" : "pdf";
  const styleParam = request.nextUrl.searchParams.get("style");
  const style = isCvStyle(styleParam) ? styleParam : "classic";
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/sign-in", request.url));
  const cv = await getCvById(viewer, id);
  if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let dateOfBirth: string | null = null;
  if (cv.doc.include.date_of_birth && !viewer.preview) {
    const s = await readSensitive(viewer.id, ["date_of_birth"]);
    dateOfBirth = s.date_of_birth ? formatDate(s.date_of_birth) : null;
  }
  // Only accepted suggestions go in the file (D-163).
  const fileDoc = finalDoc(cv.doc);
  const bytes = type === "pdf" ? Buffer.from(await renderPdf(fileDoc, { dateOfBirth }, style)) : await renderDocx(fileDoc, { dateOfBirth }, style);
  const filename = `${cv.doc.fileBase}.${type}`;
  const mime = type === "pdf" ? "application/pdf" : DOCX;

  const file = new NextResponse(new Uint8Array(bytes), { headers: { "content-type": mime, "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
  if (viewer.preview) return file;

  // The file goes straight back to the phone (D-128). A private copy is kept as well, so the
  // application holds exactly what was sent; if that copy fails, the download still works.
  const supabase = await createClient();
  const path = `${viewer.id}/${cv.id}.${type}`;
  const { error } = await supabase.storage.from("cv-exports").upload(path, bytes, { contentType: mime, upsert: true });
  if (!error && !cv.locked) await supabase.from("cv_versions").update(type === "pdf" ? { pdf_path: path } : { docx_path: path }).eq("id", cv.id).eq("user_id", viewer.id);

  const open = openFlags(cv.doc);
  if (open) await track("cv_downloaded_with_flags", { open_flags_count: open }, viewer.id);
  await track("cv_exported", { format: cv.doc.format, file_type: type, style }, viewer.id);
  after(() => recordDesignEvent("download", { style }));
  return file;
}
