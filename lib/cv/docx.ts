import "server-only";
import { AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, TabStopType, TextRun } from "docx";
import type { CvDoc } from "./types";

// The Word version of the same standard CV: one column, real headings, title and dates on
// one line with a right tab, the employer in italics below, bullets, page numbers.

const FONT = "Arial";
const TEXT_WIDTH = 9906; // A4 width minus 1000 twip margins
const ACCENT = "14275F";
const MUTED = "586679";
const BODY = "283041";

type RunOpts = { bold?: boolean; italics?: boolean; size?: number; color?: string };
const run = (text: string, o: RunOpts = {}) => new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size ?? 20, color: o.color ?? BODY, font: FONT });

export async function renderDocx(doc: CvDoc, personal: { dateOfBirth?: string | null }): Promise<Buffer> {
  const children: Paragraph[] = [];
  const center = (text: string, o: RunOpts & { after?: number; spacing?: number } = {}) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 40 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20, color: o.color ?? BODY, font: FONT, characterSpacing: o.spacing })] });
  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 240, after: 100 },
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C8CFDA", space: 3 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: ACCENT, font: FONT, characterSpacing: 24 })],
    });
  const leftRight = (left: string, right: string | null, size = 21) =>
    new Paragraph({
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      spacing: { before: 120, after: 10 },
      children: [run(left, { bold: true, size, color: "111827" }), ...(right ? [run(`\t${right}`, { size: 19, color: MUTED })] : [])],
    });
  const italicLine = (text: string) => new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [run(text, { italics: true, size: 19, color: MUTED })] });

  children.push(center(doc.name.toUpperCase(), { bold: true, size: 40, color: "111827", after: 40, spacing: 30 }));
  if (doc.titleLine) children.push(center(doc.titleLine, { bold: true, size: 22, color: ACCENT, after: 40 }));
  if (doc.contactLine) children.push(center(doc.contactLine.split(" · ").join("   |   "), { size: 18, color: MUTED, after: 20 }));
  if (doc.include.date_of_birth && personal.dateOfBirth) children.push(center(`Date of birth: ${personal.dateOfBirth}`, { size: 18, color: MUTED, after: 20 }));
  children.push(new Paragraph({ spacing: { after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: ACCENT, space: 4 } }, children: [] }));

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
