import "server-only";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import type { CoverLetter } from "@/lib/pack/letter";
import type { CvStyle } from "./styles";
import { BODY, LOOK, MUTED, PAGE } from "./docx";

// The cover letter as a Word file, in the CV design's standard font and accent (D-186), so
// the person can change a word before sending if they want to.

export async function renderLetterDocx(letter: CoverLetter, format: string, style: CvStyle = "classic"): Promise<Buffer> {
  const paper = format === "us" ? PAGE.letter : PAGE.a4;
  const look = LOOK[style];
  const FONT = look.font;
  const run = (text: string, o: { bold?: boolean; size?: number; color?: string; spacing?: number; underline?: boolean } = {}) =>
    new TextRun({ text, bold: o.bold, size: o.size ?? 21, color: o.color ?? BODY, font: FONT, characterSpacing: o.spacing, underline: o.underline ? {} : undefined });
  const para = (text: string, o: { bold?: boolean; after?: number; color?: string; underline?: boolean; line?: number } = {}) =>
    new Paragraph({ spacing: { after: o.after ?? 0, line: o.line ?? 276 }, children: [run(text, o)] });
  const align = look.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;

  const children: Paragraph[] = [
    new Paragraph({ alignment: align, spacing: { after: 60 }, children: [run(look.upperName ? letter.name.toUpperCase() : letter.name, { bold: true, size: 36, color: style === "modern" ? look.accent : "111827", spacing: look.nameSpacing })] }),
    new Paragraph({
      alignment: align,
      spacing: { after: 360 },
      border: { bottom: { style: BorderStyle.SINGLE, size: style === "modern" ? 14 : 6, color: look.accent, space: 6 } },
      children: [run(letter.sender.join("   ·   "), { size: 18, color: MUTED })],
    }),
    para(letter.date, { after: 240 }),
    ...letter.recipient.map((l, i, all) => para(l, { after: i === all.length - 1 ? 240 : 0 })),
    para(letter.salutation, { after: 160 }),
    para(letter.heading, { bold: true, after: 200, underline: /^APPLICATION FOR/.test(letter.heading), color: "111827" }),
    ...letter.paragraphs.map((p) => para(p, { after: 180, line: 300 })),
    para(letter.closing, { after: 600 }),
    para(letter.name, { bold: true, color: "111827" }),
  ];

  const document = new Document({
    creator: letter.name,
    title: `${letter.name} cover letter`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { size: { width: paper.width, height: paper.height }, margin: { top: 1000, bottom: 1000, left: 1240, right: 1240 } } }, children }],
  });
  return Packer.toBuffer(document);
}
