import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getApplication } from "@/lib/applications/data";
import { getCvById } from "@/lib/cv/data";
import { isCvStyle } from "@/lib/cv/styles";
import { renderLetterPdf } from "@/lib/cv/letter-pdf";
import { renderLetterDocx } from "@/lib/cv/letter-docx";
import { letterFileBase } from "@/lib/pack/letter";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** The application's cover letter as a PDF or Word file, in the CV's design (D-186). Made on request, never stored. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") === "docx" ? "docx" : "pdf";
  const styleParam = request.nextUrl.searchParams.get("style");
  const style = isCvStyle(styleParam) ? styleParam : "classic";
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/sign-in", request.url));
  const app = await getApplication(viewer, id);
  const letter = app?.pack?.coverLetter;
  if (!app || !letter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cv = app.cvId ? await getCvById(viewer, app.cvId) : null;
  const format = cv?.doc.format ?? "ng_private";
  const base = cv ? letterFileBase(cv.doc.fileBase) : `${letter.name.replace(/[^A-Za-z0-9]+/g, "_")}_Cover_Letter`;
  const bytes = type === "pdf" ? await renderLetterPdf(letter, format, style) : new Uint8Array(await renderLetterDocx(letter, format, style));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": type === "pdf" ? "application/pdf" : DOCX,
      "content-disposition": `attachment; filename="${base}.${type}"`,
      "cache-control": "private, no-store",
    },
  });
}
