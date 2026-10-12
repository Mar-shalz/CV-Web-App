import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { getCvById } from "@/lib/cv/data";
import { renderPdf } from "@/lib/cv/pdf";
import { renderDocx } from "@/lib/cv/docx";
import { openFlags } from "@/lib/cv/types";
import { readSensitive } from "@/lib/sensitive";
import { formatDate } from "@/lib/format";
import { track } from "@/lib/analytics/server";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Downloads a CV. Open flags never block it (they're logged). Files are stored privately
 * and served through a signed link that expires in 10 minutes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") === "docx" ? "docx" : "pdf";
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/sign-in", request.url));
  const cv = await getCvById(viewer, id);
  if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let dateOfBirth: string | null = null;
  if (cv.doc.include.date_of_birth && !viewer.preview) {
    const s = await readSensitive(viewer.id, ["date_of_birth"]);
    dateOfBirth = s.date_of_birth ? formatDate(s.date_of_birth) : null;
  }
  const bytes = type === "pdf" ? Buffer.from(await renderPdf(cv.doc, { dateOfBirth })) : await renderDocx(cv.doc, { dateOfBirth });
  const filename = `${cv.doc.fileBase}.${type}`;
  const mime = type === "pdf" ? "application/pdf" : DOCX;

  if (viewer.preview) {
    return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": mime, "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" } });
  }

  const supabase = await createClient();
  const path = `${viewer.id}/${cv.id}.${type}`;
  const { error } = await supabase.storage.from("cv-exports").upload(path, bytes, { contentType: mime, upsert: true });
  if (error) return NextResponse.json({ error: "We couldn't prepare your file. Try again." }, { status: 500 });
  if (!cv.locked) await supabase.from("cv_versions").update(type === "pdf" ? { pdf_path: path } : { docx_path: path }).eq("id", cv.id).eq("user_id", viewer.id);

  const open = openFlags(cv.doc);
  if (open) await track("cv_downloaded_with_flags", { open_flags_count: open }, viewer.id);
  await track("cv_exported", { format: cv.doc.format, file_type: type }, viewer.id);

  const { data: signed } = await supabase.storage.from("cv-exports").createSignedUrl(path, 600, { download: filename });
  if (!signed?.signedUrl) return NextResponse.json({ error: "We couldn't prepare your file." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 303);
}
