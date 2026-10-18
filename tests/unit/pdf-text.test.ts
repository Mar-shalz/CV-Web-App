import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfText, usableText } from "@/lib/uploads/pdf-text";

async function makePdf(draw: (page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont) => void): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  draw(page, font);
  return doc.save();
}

describe("pdfText (D-183)", () => {
  it("keeps a one column CV in order, with right aligned dates on their role's line", async () => {
    const bytes = await makePdf((page, font) => {
      let y = 800;
      page.drawText("Tolu Adebayo", { x: 50, y, size: 18, font });
      page.drawText("tolu.adebayo@example.com  +234 803 000 0000", { x: 50, y: (y -= 22), size: 10, font });
      for (const [role, dates] of [
        ["Finance Assistant, Ministry of Works", "Jan 2025 to Dec 2025"],
        ["SIWES Intern, Northline Bank", "Jun 2023 to Nov 2023"],
      ] as const) {
        y -= 30;
        page.drawText(role, { x: 50, y, size: 11, font });
        page.drawText(dates, { x: 420, y, size: 11, font });
        for (let n = 0; n < 4; n++) page.drawText(`Prepared monthly expense summaries and matched them to payment vouchers, line ${n + 1}`, { x: 60, y: (y -= 16), size: 10, font });
      }
    });
    const out = await pdfText(bytes);
    expect(out).not.toBeNull();
    const lines = out!.text.split("\n");
    expect(lines[0]).toBe("Tolu Adebayo");
    expect(out!.text).toContain("tolu.adebayo@example.com");
    expect(lines.find((l) => l.startsWith("Finance Assistant"))).toContain("Jan 2025 to Dec 2025");
    expect(out!.text.indexOf("Finance Assistant")).toBeLessThan(out!.text.indexOf("SIWES Intern"));
  });

  it("reads a sidebar CV column by column instead of mixing the two", async () => {
    const bytes = await makePdf((page, font) => {
      const side = ["Skills", "Excel", "Sage 50", "Reconciliation", "Customer onboarding", "Languages", "English", "Yoruba", "Contact", "Lagos, Nigeria"];
      const main = ["Experience", "Finance Assistant at the Ministry of Works in Ibadan", "Prepared the finance unit's monthly expense summaries", "Matched every summary to its payment vouchers", "SIWES Intern at Northline Bank in Yaba", "Opened about 15 customer accounts a day at the branch", "Checked every customer's documents before opening", "Education", "B.Sc. Accounting, University of Lagos", "Second Class Upper"];
      main.forEach((t, n) => page.drawText(t, { x: 210, y: 780 - n * 18, size: 10, font }));
      side.forEach((t, n) => page.drawText(t, { x: 40, y: 780 - n * 18, size: 10, font }));
    });
    const out = await pdfText(bytes);
    expect(out).not.toBeNull();
    const lines = out!.text.split("\n").filter(Boolean);
    // Each column's lines come out whole and together, not as "Excel Finance Assistant...".
    expect(lines).toContain("Finance Assistant at the Ministry of Works in Ibadan");
    expect(lines).toContain("Excel");
    expect(lines.indexOf("Sage 50")).toBe(lines.indexOf("Excel") + 1);
    expect(lines.indexOf("Matched every summary to its payment vouchers")).toBe(lines.indexOf("Prepared the finance unit's monthly expense summaries") + 1);
  });

  it("keeps a dates column on the left on its role's line", async () => {
    const bytes = await makePdf((page, font) => {
      let y = 800;
      for (const [dates, role] of [
        ["2025", "Finance Assistant, Ministry of Works"],
        ["2023", "SIWES Intern, Northline Bank"],
        ["2022", "Class Representative, University of Lagos"],
      ] as const) {
        page.drawText(dates, { x: 40, y, size: 10, font });
        page.drawText(role, { x: 120, y, size: 11, font });
        for (let n = 0; n < 4; n++) page.drawText(`Prepared monthly expense summaries and matched them to vouchers ${n + 1}`, { x: 120, y: (y -= 15), size: 10, font });
        y -= 25;
      }
    });
    const out = await pdfText(bytes);
    expect(out!.text.split("\n")).toContain("2023   SIWES Intern, Northline Bank");
  });

  it("returns null for a PDF with no text layer and for junk", async () => {
    const blank = await makePdf(() => undefined);
    expect(await pdfText(blank)).toBeNull();
    expect(await pdfText(new TextEncoder().encode("not a pdf at all"))).toBeNull();
    expect(usableText("�".repeat(300))).toBe(false);
    expect(usableText("Prepared monthly expense summaries and matched them to payment vouchers. ".repeat(3))).toBe(true);
  });
});
