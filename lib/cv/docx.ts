import "server-only";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { CvDoc } from "./types";

const FONT = "Arial";
const TEXT_WIDTH = 9906; // A4 width minus 1000 twip margins

export async function renderDocx(doc: CvDoc, personal: { dateOfBirth?: string | null }): Promise<Buffer> {
  const children: Paragraph[] = [];
  const p = (text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {}) =>
    new Paragraph({ alignment: opts.align, spacing: { after: opts.after ?? 60 }, children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 20, color: opts.color, font: FONT })] });
  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 200, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "C8CFDA", space: 2 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: "14275F", font: FONT })],
    });

  children.push(p(doc.name, { bold: true, size: 34, align: AlignmentType.CENTER, after: 40 }));
  if (doc.contactLine) children.push(p(doc.contactLine, { size: 19, color: "586679", align: AlignmentType.CENTER }));
  if (doc.include.date_of_birth && personal.dateOfBirth) children.push(p(`Date of birth: ${personal.dateOfBirth}`, { size: 19, color: "586679", align: AlignmentType.CENTER }));
  if (doc.titleLine) children.push(p(doc.titleLine, { bold: true, size: 22, color: "14275F", align: AlignmentType.CENTER, after: 120 }));
  if (doc.summary.text) {
    children.push(heading("Profile"));
    children.push(p(doc.summary.text));
  }
  for (const s of doc.sections) {
    children.push(heading(s.heading));
    if (s.kind === "lines") {
      for (const l of s.lines) children.push(p(l));
      continue;
    }
    for (const r of s.roles) {
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: [r.title, r.organisation].filter(Boolean).join(", "), bold: true, size: 21, font: FONT }),
            new TextRun({ text: `\t${r.dates}`, size: 19, color: "586679", font: FONT }),
          ],
        }),
      );
      for (const b of r.bullets) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: b.text, size: 20, font: FONT })] }));
    }
  }
  const document = new Document({
    creator: doc.name,
    title: `${doc.name} CV`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBuffer(document);
}
