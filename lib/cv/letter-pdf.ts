import "server-only";
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CoverLetter } from "@/lib/pack/letter";
import type { CvStyle } from "./styles";
import { onLetterPaper } from "./format";
import { A4_SIZE, BAND, BODY, FEATURES, INK, LETTER, LOOK, MUTED, RULE, TINT, fontBytes, safe, wrap } from "./pdf";

// The cover letter in the same design as the CV (D-186): the CV's typeface, accent and
// header, so the two read as a set. A formal business letter below the header: date,
// recipient, greeting, heading, the paragraphs, the sign-off. Real text throughout.

const MX = 62;
const MT = 50;
const MB = 56;

export async function renderLetterPdf(letter: CoverLetter, format: string, style: CvStyle = "classic"): Promise<Uint8Array> {
  const SIZE = onLetterPaper(format) ? LETTER : A4_SIZE;
  const W = SIZE.w - MX * 2;
  const look = LOOK[style];
  const ACCENT = look.accent;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${letter.name} cover letter`);
  pdf.setAuthor(letter.name);
  pdf.setSubject("Cover letter");
  pdf.setCreator("Cover letter export");
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all(["Regular", "Bold"].map(async (w) => pdf.embedFont(await fontBytes(`${look.font}-${w}.ttf`), { subset: true, features: FEATURES })));

  let page: PDFPage = pdf.addPage([SIZE.w, SIZE.h]);
  let y = SIZE.h - MT;
  const ensure = (h: number) => {
    if (y - h < MB) {
      page = pdf.addPage([SIZE.w, SIZE.h]);
      y = SIZE.h - MT;
    }
  };
  const draw = (t: string, x: number, size: number, font: PDFFont, color: RGB) => page.drawText(safe(t), { x, y: y - size, size, font, color });
  const spaced = (t: string, x: number, size: number, font: PDFFont, color: RGB, tracking: number) => {
    page.pushOperators(pushGraphicsState(), setCharacterSpacing(tracking));
    page.drawText(safe(t), { x, y: y - size, size, font, color });
    page.pushOperators(popGraphicsState());
  };
  const width = (t: string, size: number, font: PDFFont, tracking = 0) => font.widthOfTextAtSize(safe(t), size) + tracking * Math.max(0, [...safe(t)].length - 1);
  const lines = (items: string[], size: number, font: PDFFont, color: RGB, lh = size * 1.45) => {
    for (const t of items) {
      for (const line of wrap(t, font, size, W)) {
        ensure(lh);
        draw(line, MX, size, font, color);
        y -= lh;
      }
    }
  };

  // Header: the CV's own header, with the person's contact details.
  const name = look.upperName ? letter.name.toUpperCase() : letter.name;
  const contact = letter.sender.join("  ·  ");
  if (look.header === "band") {
    const bandH = 78;
    page.drawRectangle({ x: 0, y: SIZE.h - bandH, width: SIZE.w, height: bandH, color: BAND });
    page.drawRectangle({ x: 0, y: SIZE.h - bandH - 4, width: SIZE.w, height: 4, color: ACCENT });
    y = SIZE.h - 30;
    spaced(name, MX, look.nameSize - 2, bold, rgb(1, 1, 1), look.nameTracking);
    y = SIZE.h - bandH - 4;
    page.drawRectangle({ x: 0, y: y - 24, width: SIZE.w, height: 24, color: TINT });
    y -= 7;
    draw(contact, MX, 9.2, regular, INK);
    y = SIZE.h - bandH - 4 - 24 - 30;
  } else {
    const size = look.nameSize - 2;
    const nw = width(name, size, bold, look.nameTracking);
    const x = look.header === "center" ? (SIZE.w - nw) / 2 : MX;
    spaced(name, x, size, bold, look.header === "left" ? ACCENT : INK, look.nameTracking);
    y -= size + 8;
    const cw = width(contact, 9.2, regular);
    draw(contact, look.header === "center" ? (SIZE.w - cw) / 2 : MX, 9.2, regular, MUTED);
    y -= 18;
    page.drawLine({ start: { x: MX, y }, end: { x: SIZE.w - MX, y }, thickness: look.header === "left" ? 1.6 : 0.8, color: look.header === "left" ? ACCENT : style === "executive" ? INK : RULE });
    y -= 30;
  }

  // The letter.
  const size = 10.5;
  lines([letter.date], size, regular, BODY);
  y -= 12;
  lines(letter.recipient, size, regular, BODY, size * 1.4);
  y -= 14;
  lines([letter.salutation], size, regular, BODY);
  y -= 8;
  for (const line of wrap(letter.heading, bold, size, W)) {
    ensure(size * 1.5);
    draw(line, MX, size, bold, look.header === "left" ? ACCENT : INK);
    // Nigerian letters underline the heading.
    if (/^APPLICATION FOR/.test(letter.heading)) page.drawLine({ start: { x: MX, y: y - size - 2 }, end: { x: MX + width(line, size, bold), y: y - size - 2 }, thickness: 0.7, color: INK });
    y -= size * 1.5;
  }
  y -= 8;
  for (const p of letter.paragraphs) {
    lines([p], size, regular, BODY, size * 1.5);
    y -= 9;
  }
  ensure(70);
  lines([letter.closing], size, regular, BODY);
  y -= 30;
  lines([letter.name], size, bold, INK);

  return pdf.save();
}
