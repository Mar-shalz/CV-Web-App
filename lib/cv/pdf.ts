import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { CvDoc, CvEntry, CvRoleBlock } from "./types";
import type { CvStyle } from "./styles";

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
const RULE = rgb(0.78, 0.81, 0.86);

// The three designs (D-142): type, accent colour and header layout. Everything else is shared.
const LOOK: Record<CvStyle, { accent: RGB; fonts: [StandardFonts, StandardFonts, StandardFonts]; header: "center" | "left" | "band"; upperName: boolean; nameTracking: number; nameSize: number; headingCase: "upper" | "title" | "marker" }> = {
  classic: { accent: rgb(0.08, 0.15, 0.37), fonts: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique], header: "center", upperName: true, nameTracking: 1.6, nameSize: 21, headingCase: "upper" },
  modern: { accent: rgb(0.12, 0.33, 0.85), fonts: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique], header: "left", upperName: false, nameTracking: 0, nameSize: 25, headingCase: "title" },
  executive: { accent: rgb(0.1, 0.1, 0.12), fonts: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic], header: "center", upperName: true, nameTracking: 2.4, nameSize: 22, headingCase: "upper" },
  // Signature (D-153): a deep teal band behind the name (real text, so hiring software reads
  // it), teal section markers and employer lines. Still one column, top to bottom.
  signature: { accent: rgb(0.04, 0.47, 0.47), fonts: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique], header: "band", upperName: false, nameTracking: 0.4, nameSize: 27, headingCase: "marker" },
};
const BAND = rgb(0.04, 0.2, 0.25);
const BAND_TEXT = rgb(0.74, 0.9, 0.9);
const TINT = rgb(0.91, 0.96, 0.96);

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

export async function renderPdf(doc: CvDoc, personal: { dateOfBirth?: string | null }, style: CvStyle = "classic"): Promise<Uint8Array> {
  const look = LOOK[style];
  const ACCENT = look.accent;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.name} CV`);
  pdf.setAuthor(doc.name);
  pdf.setSubject(doc.jobTitle ? `CV for ${doc.jobTitle}` : "CV");
  pdf.setCreator("CV export");
  const regular = await pdf.embedFont(look.fonts[0]);
  const bold = await pdf.embedFont(look.fonts[1]);
  const italic = await pdf.embedFont(look.fonts[2]);

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
    if (look.headingCase === "marker") {
      // Signature: a small teal square, the heading, then a fine rule to the margin.
      page.drawRectangle({ x: MX, y: y - 9.5, width: 7, height: 7, color: ACCENT });
      const label = safe(t.toUpperCase());
      const w = spaced(label, MX + 14, 10, bold, ACCENT, 1.2);
      page.drawLine({ start: { x: MX + 14 + w + 10, y: y - 6 }, end: { x: A4.w - MX, y: y - 6 }, thickness: 0.6, color: rgb(0.78, 0.88, 0.88) });
      y -= 18;
    } else if (look.headingCase === "upper") {
      spaced(t.toUpperCase(), MX, 10, bold, ACCENT, 1.1);
      y -= 15;
      page.drawLine({ start: { x: MX, y }, end: { x: A4.w - MX, y }, thickness: 0.7, color: style === "executive" ? INK : RULE });
    } else {
      // Modern: the heading in the accent colour with a short bar under it.
      draw(safe(t.charAt(0).toUpperCase() + t.slice(1)), MX, 12, bold, ACCENT);
      y -= 17;
      page.drawLine({ start: { x: MX, y }, end: { x: MX + 34, y }, thickness: 2.2, color: ACCENT });
    }
    y -= 8;
  };

  // Header: name, the line that says who you are, then how to reach you.
  const nameSize = look.nameSize;
  const name = look.upperName ? doc.name.toUpperCase() : doc.name;
  ensure(40);
  if (look.header === "band") {
    // A full width band at the top of page one, with the name and title in it.
    const bandH = doc.titleLine ? 104 : 84;
    page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: BAND });
    page.drawRectangle({ x: 0, y: A4.h - bandH - 4, width: A4.w, height: 4, color: ACCENT });
    y = A4.h - 34;
    spaced(safe(name), MX, nameSize, bold, rgb(1, 1, 1), look.nameTracking);
    y -= nameSize + 10;
    if (doc.titleLine) draw(safe(doc.titleLine), MX, 11.5, regular, BAND_TEXT);
    y = A4.h - bandH - 4 - 16;
    if (doc.contactLine) {
      const parts = doc.contactLine.split(" · ").map(safe);
      // Contact details on a light tint strip, each separated by a teal dot.
      page.drawRectangle({ x: 0, y: y - 20, width: A4.w, height: 26, color: TINT });
      let x = MX;
      parts.forEach((p, i) => {
        if (i) {
          page.drawCircle({ x: x + 6, y: y - 7.5, size: 1.6, color: ACCENT });
          x += 14;
        }
        page.drawText(p, { x, y: y - 10.5, size: 9.2, font: regular, color: INK });
        x += regular.widthOfTextAtSize(p, 9.2) + 2;
      });
      y -= 30;
    }
    if (doc.include.date_of_birth && personal.dateOfBirth) paragraph(`Date of birth: ${personal.dateOfBirth}`, 9.2, regular, MUTED, 13);
    y -= 2;
  } else if (look.header === "center") {
    const nw = spacedWidth(name, nameSize, bold, look.nameTracking);
    spaced(name, (A4.w - Math.min(nw, W)) / 2, nameSize, bold, INK, nw > W ? 0 : look.nameTracking);
    y -= nameSize * 1.3;
    if (doc.titleLine) centered(doc.titleLine, 11, bold, ACCENT, 15);
    y -= 2;
    if (doc.contactLine) centered(doc.contactLine.split(" · ").join("   |   "), 9.2, regular, MUTED, 13);
    if (doc.include.date_of_birth && personal.dateOfBirth) centered(`Date of birth: ${personal.dateOfBirth}`, 9.2, regular, MUTED, 13);
    y -= 6;
    page.drawLine({ start: { x: MX, y }, end: { x: A4.w - MX, y }, thickness: style === "executive" ? 0.8 : 1.4, color: ACCENT });
    if (style === "executive") {
      y -= 2.5;
      page.drawLine({ start: { x: MX, y }, end: { x: A4.w - MX, y }, thickness: 0.8, color: ACCENT });
    }
    y -= 4;
  } else {
    draw(safe(name), MX, nameSize, bold, ACCENT);
    y -= nameSize * 1.25;
    if (doc.titleLine) paragraph(doc.titleLine, 11.5, bold, INK, 15.5);
    y -= 2;
    if (doc.contactLine) paragraph(doc.contactLine.split(" · ").join("   ·   "), 9.2, regular, MUTED, 13);
    if (doc.include.date_of_birth && personal.dateOfBirth) paragraph(`Date of birth: ${personal.dateOfBirth}`, 9.2, regular, MUTED, 13);
    y -= 4;
  }

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
      if (style === "signature") draw(safe(where), MX, 9.8, bold, ACCENT);
      else draw(safe(where), MX, 9.6, italic, MUTED);
      y -= 14;
    }
    y -= 2;
    for (const b of r.bullets) {
      const lines = wrap(b.text, regular, 10, W - 14);
      lines.forEach((line, i) => {
        ensure(14);
        if (i === 0) draw(style === "modern" ? "–" : "•", MX + 3, 10, bold, ACCENT);
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
