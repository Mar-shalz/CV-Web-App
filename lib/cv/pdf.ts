import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { CvDoc, CvEntry, CvRoleBlock } from "./types";

// A standard professional CV (CV writing standard): A4, one column, real selectable text
// that applicant tracking systems read, name and contact at the top, clear section rules,
// role title and dates on one line with the employer below, hanging bullets, and page
// numbers. Standard fonts aren't embedded, which keeps the file far under 150KB.

const A4 = { w: 595.28, h: 841.89 };
const MX = 50;
const MT = 46;
const MB = 52;
const W = A4.w - MX * 2;
const INK = rgb(0.07, 0.09, 0.15);
const BODY = rgb(0.16, 0.19, 0.25);
const MUTED = rgb(0.36, 0.41, 0.48);
const ACCENT = rgb(0.08, 0.15, 0.37);
const RULE = rgb(0.78, 0.81, 0.86);

/** Standard fonts use WinAnsi: swap the few characters they can't draw. */
export function safe(text: string): string {
  return text
    .replace(/₦\s?/g, "NGN ")
    .replace(/—/g, ", ")
    .replace(/[‐‑]/g, "-")
    .replace(/[^\x20-\x7E -ÿ‘’“”•–…]/g, "");
}

/** Word wrap, with a narrower first line when something sits before it (a bold label). */
function wrap(text: string, font: PDFFont, size: number, width: number, firstWidth = width): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const limit = lines.length === 0 ? firstWidth : width;
    if (font.widthOfTextAtSize(test, size) > limit && line) {
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
  pdf.setSubject(doc.jobTitle ? `CV for ${doc.jobTitle}` : "CV");
  pdf.setCreator("CV export");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MT;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MT;
  };
  const ensure = (h: number) => {
    if (y - h < MB) newPage();
  };
  const draw = (t: string, x: number, size: number, font: PDFFont, color: RGB) => page.drawText(t, { x, y: y - size, size, font, color });

  /** Letter spaced capitals for section headings. */
  const spaced = (t: string, x: number, size: number, font: PDFFont, color: RGB, tracking: number) => {
    let cx = x;
    for (const ch of safe(t)) {
      page.drawText(ch, { x: cx, y: y - size, size, font, color });
      cx += font.widthOfTextAtSize(ch, size) + tracking;
    }
    return cx - x - tracking;
  };
  const spacedWidth = (t: string, size: number, font: PDFFont, tracking: number) => [...safe(t)].reduce((s, ch) => s + font.widthOfTextAtSize(ch, size) + tracking, -tracking);

  const paragraph = (t: string, size = 10, font = regular, color = BODY, lh = size * 1.42, indent = 0) => {
    for (const line of wrap(t, font, size, W - indent)) {
      ensure(lh);
      draw(line, MX + indent, size, font, color);
      y -= lh;
    }
  };
  const centered = (t: string, size: number, font: PDFFont, color: RGB, lh = size * 1.35) => {
    for (const line of wrap(t, font, size, W)) {
      ensure(lh);
      draw(line, (A4.w - font.widthOfTextAtSize(line, size)) / 2, size, font, color);
      y -= lh;
    }
  };
  /** Bold left text and muted right text on one line (title and dates). */
  const leftRight = (left: string, right: string | null, leftFont: PDFFont, size: number) => {
    const r = right ? safe(right) : "";
    const rw = r ? regular.widthOfTextAtSize(r, size - 1) : 0;
    const lines = wrap(left, leftFont, size, W - rw - 14);
    lines.forEach((line, i) => {
      ensure(size * 1.4);
      draw(line, MX, size, leftFont, INK);
      if (i === 0 && r) draw(r, A4.w - MX - rw, size - 1, regular, MUTED);
      y -= size * 1.4;
    });
  };
  const heading = (t: string) => {
    // Keep a heading with at least its first two lines.
    ensure(52);
    y -= 10;
    spaced(t.toUpperCase(), MX, 10, bold, ACCENT, 1.1);
    y -= 15;
    page.drawLine({ start: { x: MX, y }, end: { x: A4.w - MX, y }, thickness: 0.7, color: RULE });
    y -= 8;
  };

  // Header: name, the line that says who you are, then how to reach you.
  const nameSize = 21;
  ensure(40);
  const nw = spacedWidth(doc.name.toUpperCase(), nameSize, bold, 1.6);
  spaced(doc.name.toUpperCase(), (A4.w - Math.min(nw, W)) / 2, nameSize, bold, INK, nw > W ? 0 : 1.6);
  y -= nameSize * 1.3;
  if (doc.titleLine) centered(doc.titleLine, 11, bold, ACCENT, 15);
  y -= 2;
  if (doc.contactLine) centered(doc.contactLine.split(" · ").join("   |   "), 9.2, regular, MUTED, 13);
  if (doc.include.date_of_birth && personal.dateOfBirth) centered(`Date of birth: ${personal.dateOfBirth}`, 9.2, regular, MUTED, 13);
  y -= 6;
  page.drawLine({ start: { x: MX, y }, end: { x: A4.w - MX, y }, thickness: 1.4, color: ACCENT });
  y -= 4;

  if (doc.summary.text) {
    heading(doc.format === "uk" ? "Profile" : "Profile summary");
    paragraph(doc.summary.text, 10, regular, BODY, 14.4);
  }

  const role = (r: CvRoleBlock) => {
    ensure(46);
    leftRight(r.title || r.organisation || "", r.dates, bold, 10.6);
    const where = [r.title ? r.organisation : null, r.location].filter(Boolean).join(", ");
    if (where) {
      ensure(13);
      draw(safe(where), MX, 9.6, italic, MUTED);
      y -= 14;
    }
    y -= 2;
    for (const b of r.bullets) {
      const lines = wrap(b.text, regular, 10, W - 14);
      lines.forEach((line, i) => {
        ensure(14);
        if (i === 0) draw("•", MX + 3, 10, bold, ACCENT);
        draw(line, MX + 14, 10, regular, BODY);
        y -= 14;
      });
      y -= 1.5;
    }
    y -= 7;
  };

  const entry = (e: CvEntry) => {
    ensure(34);
    leftRight(e.title, e.dates, bold, 10.4);
    if (e.subtitle) {
      for (const line of wrap(e.subtitle, italic, 9.6, W)) {
        ensure(13.5);
        draw(line, MX, 9.6, italic, MUTED);
        y -= 13.5;
      }
    }
    if (e.detail) paragraph(e.detail, 9.8, regular, BODY, 13.8);
    y -= 6;
  };

  /** "Label: values" lines get a bold label, like "Tools and software: Excel, SAP". */
  const labelled = (l: string) => {
    const at = l.indexOf(": ");
    if (at <= 0 || at > 30) {
      paragraph(l, 10, regular, BODY, 14.2);
      return;
    }
    const label = safe(l.slice(0, at + 1));
    const rest = l.slice(at + 2);
    const lw = bold.widthOfTextAtSize(`${label} `, 10);
    const lines = wrap(rest, regular, 10, W, W - lw);
    lines.forEach((line, i) => {
      ensure(14.2);
      // The space is drawn with the label, so text readers see "Label: value".
      if (i === 0) draw(`${label} `, MX, 10, bold, INK);
      draw(line, MX + (i === 0 ? lw : 0), 10, regular, BODY);
      y -= 14.2;
    });
    y -= 1;
  };

  for (const s of doc.sections) {
    heading(s.heading);
    if (s.kind === "roles") s.roles.forEach(role);
    else if (s.kind === "entries") s.entries.forEach(entry);
    else s.lines.forEach(labelled);
  }

  // Footer on every page: who, and page x of n.
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = safe(`${doc.name}  ·  CV  ·  Page ${i + 1} of ${pages.length}`);
    const size = 8;
    p.drawText(label, { x: (A4.w - regular.widthOfTextAtSize(label, size)) / 2, y: 26, size, font: regular, color: MUTED });
  });
  return pdf.save({ useObjectStreams: true });
}
