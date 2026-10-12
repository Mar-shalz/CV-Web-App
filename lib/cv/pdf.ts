import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CvDoc } from "./types";

// One standard font, real text, single column, A4 (CV writing standard). Standard fonts
// aren't embedded, which keeps the file far under the 150KB limit.

const A4 = { w: 595.28, h: 841.89 };
const M = 50;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.35, 0.4, 0.47);
const ACCENT = rgb(0.08, 0.15, 0.37);

/** Standard fonts use WinAnsi: swap the few characters it can't draw. */
export function safe(text: string): string {
  return text
    .replace(/₦\s?/g, "NGN ")
    .replace(/—/g, ", ")
    .replace(/[‐‑]/g, "-")
    .replace(/[^\x20-\x7E -ÿ‘’“”•–…]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPdf(doc: CvDoc, personal: { dateOfBirth?: string | null }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.name} CV`);
  pdf.setAuthor(doc.name);
  pdf.setCreator("CV export");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const width = A4.w - M * 2;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };
  const text = (t: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; lh?: number; maxWidth?: number }) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const lh = opts.lh ?? size * 1.38;
    for (const line of wrap(t, font, size, opts.maxWidth ?? width - ((opts.x ?? M) - M))) {
      ensure(lh);
      page.drawText(line, { x: opts.x ?? M, y: y - size, size, font, color: opts.color ?? INK });
      y -= lh;
    }
  };
  const center = (t: string, font: PDFFont, size: number, color = INK) => {
    for (const line of wrap(t, font, size, width)) {
      ensure(size * 1.4);
      page.drawText(line, { x: (A4.w - font.widthOfTextAtSize(line, size)) / 2, y: y - size, size, font, color });
      y -= size * 1.4;
    }
  };
  const heading = (t: string) => {
    ensure(30);
    y -= 8;
    page.drawText(safe(t.toUpperCase()), { x: M, y: y - 10, size: 10, font: bold, color: ACCENT });
    y -= 15;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.6, color: rgb(0.8, 0.83, 0.88) });
    y -= 7;
  };

  center(doc.name, bold, 18);
  if (doc.contactLine) center(doc.contactLine, regular, 9.5, MUTED);
  if (doc.include.date_of_birth && personal.dateOfBirth) center(`Date of birth: ${personal.dateOfBirth}`, regular, 9.5, MUTED);
  if (doc.titleLine) {
    y -= 2;
    center(doc.titleLine, bold, 11, ACCENT);
  }
  if (doc.summary.text) {
    heading("Profile");
    text(doc.summary.text, { size: 10 });
  }
  for (const s of doc.sections) {
    heading(s.heading);
    if (s.kind === "lines") {
      for (const l of s.lines) text(l, { size: 10 });
      continue;
    }
    for (const r of s.roles) {
      ensure(30);
      const head = safe([r.title, r.organisation].filter(Boolean).join(", "));
      const dates = safe(r.dates);
      const dw = regular.widthOfTextAtSize(dates, 9.5);
      const headLines = wrap(head, bold, 10.5, width - dw - 12);
      headLines.forEach((line, i) => {
        ensure(15);
        page.drawText(line, { x: M, y: y - 10.5, size: 10.5, font: bold, color: INK });
        if (i === 0) page.drawText(dates, { x: A4.w - M - dw, y: y - 10.5, size: 9.5, font: regular, color: MUTED });
        y -= 14.5;
      });
      for (const b of r.bullets) {
        const lines = wrap(b.text, regular, 10, width - 14);
        lines.forEach((line, i) => {
          ensure(13.8);
          if (i === 0) page.drawText("•", { x: M + 2, y: y - 10, size: 10, font: regular, color: INK });
          page.drawText(line, { x: M + 14, y: y - 10, size: 10, font: regular, color: INK });
          y -= 13.8;
        });
      }
      y -= 5;
    }
  }
  return pdf.save({ useObjectStreams: true });
}
