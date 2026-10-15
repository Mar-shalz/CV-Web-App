import "server-only";
import { AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, ShadingType, TabStopType, TextRun } from "docx";
import type { CvDoc } from "./types";
import type { CvStyle } from "./styles";

// The Word version of the same standard CV: one column, real headings, title and dates on
// one line with a right tab, the employer in italics below, bullets, page numbers.

const TEXT_WIDTH = 9906; // A4 width minus 1000 twip margins
const MUTED = "586679";
const BODY = "283041";

// The three designs (D-142), matching the PDF.
const LOOK: Record<CvStyle, { font: string; accent: string; header: "center" | "left"; upperName: boolean; nameSpacing: number; upperHeadings: boolean }> = {
  classic: { font: "Arial", accent: "14275F", header: "center", upperName: true, nameSpacing: 30, upperHeadings: true },
  modern: { font: "Calibri", accent: "1F54D9", header: "left", upperName: false, nameSpacing: 0, upperHeadings: false },
  executive: { font: "Times New Roman", accent: "1A1A1F", header: "center", upperName: true, nameSpacing: 48, upperHeadings: true },
  signature: { font: "Calibri", accent: "0A7878", header: "left", upperName: false, nameSpacing: 8, upperHeadings: true },
};
const BAND = "0A3340";
const BAND_TEXT = "BDE6E6";
const TINT = "E8F5F5";

type RunOpts = { bold?: boolean; italics?: boolean; size?: number; color?: string };

export async function renderDocx(doc: CvDoc, personal: { dateOfBirth?: string | null }, style: CvStyle = "classic"): Promise<Buffer> {
  const look = LOOK[style];
  const FONT = look.font;
  const ACCENT = look.accent;
  const run = (text: string, o: RunOpts = {}) => new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size ?? 20, color: o.color ?? BODY, font: FONT });
  const children: Paragraph[] = [];
  const center = (text: string, o: RunOpts & { after?: number; spacing?: number } = {}) =>
    new Paragraph({ alignment: look.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: o.after ?? 40 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20, color: o.color ?? BODY, font: FONT, characterSpacing: o.spacing })] });
  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 240, after: 100 },
      keepNext: true,
      border:
        style === "signature"
          ? { left: { style: BorderStyle.SINGLE, size: 36, color: ACCENT, space: 6 }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "C7E3E3", space: 3 } }
          : { bottom: { style: BorderStyle.SINGLE, size: look.upperHeadings ? 6 : 12, color: look.upperHeadings ? (style === "executive" ? "1A1A1F" : "C8CFDA") : ACCENT, space: 3 } },
      children: [new TextRun({ text: look.upperHeadings ? text.toUpperCase() : text.charAt(0).toUpperCase() + text.slice(1), bold: true, size: look.upperHeadings ? 20 : 24, color: ACCENT, font: FONT, characterSpacing: look.upperHeadings ? 24 : 0 })],
    });
  const leftRight = (left: string, right: string | null, size = 21) =>
    new Paragraph({
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      spacing: { before: 120, after: 10 },
      children: [run(left, { bold: true, size, color: "111827" }), ...(right ? [run(`\t${right}`, { size: 19, color: MUTED })] : [])],
    });
  const italicLine = (text: string) => new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [run(text, style === "signature" ? { bold: true, size: 19, color: ACCENT } : { italics: true, size: 19, color: MUTED })] });

  if (style === "signature") {
    // The band: name and title on deep teal, contacts on a light tint (real text throughout).
    const band = (text: string, o: RunOpts & { before?: number; after?: number; fill: string }) =>
      new Paragraph({ shading: { type: ShadingType.CLEAR, fill: o.fill, color: "auto" }, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, indent: { left: 120, right: 120 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20, color: o.color ?? BODY, font: FONT })] });
    children.push(band(" ", { fill: BAND, size: 10 }));
    children.push(band(doc.name, { fill: BAND, bold: true, size: 52, color: "FFFFFF" }));
    if (doc.titleLine) children.push(band(doc.titleLine, { fill: BAND, size: 22, color: BAND_TEXT, after: 0 }));
    children.push(band(" ", { fill: BAND, size: 12 }));
    if (doc.contactLine) children.push(band(doc.contactLine.split(" · ").join("   •   "), { fill: TINT, size: 18, color: "1F2937" }));
    if (doc.include.date_of_birth && personal.dateOfBirth) children.push(band(`Date of birth: ${personal.dateOfBirth}`, { fill: TINT, size: 18, color: "1F2937" }));
  } else {
  children.push(center(look.upperName ? doc.name.toUpperCase() : doc.name, { bold: true, size: style === "modern" ? 48 : 40, color: style === "modern" ? ACCENT : "111827", after: 40, spacing: look.nameSpacing }));
  if (doc.titleLine) children.push(center(doc.titleLine, { bold: true, size: 22, color: style === "modern" ? "111827" : ACCENT, after: 40 }));
  if (doc.contactLine) children.push(center(doc.contactLine.split(" · ").join(look.header === "center" ? "   |   " : "   ·   "), { size: 18, color: MUTED, after: 20 }));
  if (doc.include.date_of_birth && personal.dateOfBirth) children.push(center(`Date of birth: ${personal.dateOfBirth}`, { size: 18, color: MUTED, after: 20 }));
  if (style !== "modern") children.push(new Paragraph({ spacing: { after: 80 }, border: { bottom: { style: style === "executive" ? BorderStyle.DOUBLE : BorderStyle.SINGLE, size: style === "executive" ? 6 : 14, color: ACCENT, space: 4 } }, children: [] }));
  }

  if (doc.summary.text) {
    children.push(heading(doc.format === "uk" ? "Profile" : "Profile summary"));
    children.push(new Paragraph({ spacing: { after: 60, line: 300 }, children: [run(doc.summary.text)] }));
  }

  for (const s of doc.sections) {
    children.push(heading(s.heading));
    if (s.kind === "roles") {
      for (const r of s.roles) {
        children.push(leftRight(r.title || r.organisation || "", r.dates));
        const where = [r.title ? r.organisation : null, r.location].filter(Boolean).join(", ");
        if (where) children.push(italicLine(where));
        for (const b of r.bullets) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40, line: 280 }, children: [run(b.text)] }));
      }
    } else if (s.kind === "entries") {
      for (const e of s.entries) {
        children.push(leftRight(e.title, e.dates, 20));
        if (e.subtitle) children.push(italicLine(e.subtitle));
        if (e.detail) children.push(new Paragraph({ spacing: { after: 60 }, children: [run(e.detail, { size: 19 })] }));
      }
    } else {
      for (const l of s.lines) {
        const at = l.indexOf(": ");
        children.push(
          new Paragraph({
            spacing: { after: 50, line: 280 },
            children: at > 0 && at < 30 ? [run(`${l.slice(0, at + 1)} `, { bold: true, color: "111827" }), run(l.slice(at + 2))] : [run(l)],
          }),
        );
      }
    }
  }

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${doc.name}  ·  CV  ·  Page `, size: 16, color: MUTED, font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: FONT }), new TextRun({ text: " of ", size: 16, color: MUTED, font: FONT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: FONT })],
      }),
    ],
  });

  const document = new Document({
    creator: doc.name,
    title: `${doc.name} CV`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 1000, left: 1000, right: 1000 } } }, footers: { default: footer }, children }],
  });
  return Packer.toBuffer(document);
}
