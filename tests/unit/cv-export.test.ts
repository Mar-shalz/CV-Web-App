import { describe, expect, it } from "vitest";
import { renderPdf, safe } from "@/lib/cv/pdf";
import { renderDocx } from "@/lib/cv/docx";
import { demoCvDoc } from "@/lib/demo/cv-doc";

describe("CV export", () => {
  it("PDF stays under 150KB with real text", async () => {
    const bytes = await renderPdf(demoCvDoc(), {});
    expect(bytes.byteLength).toBeLessThan(150 * 1024);
    expect(Buffer.from(bytes).toString("latin1")).toContain("%PDF");
  });
  it("DOCX is produced", async () => {
    const buf = await renderDocx(demoCvDoc(), {});
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
  it("keeps ₦ and accents, turns em dashes into commas, drops what the typefaces can't draw (D-157)", () => {
    expect(safe("Collected ₦5,000 — monthly")).toBe("Collected ₦5,000, monthly");
    expect(safe("Café “launch” at Ọ̀yọ́ 😀 中文")).toBe("Café “launch” at Oyo  ");
  });
});
