import "server-only";

// Reads the text layer of an uploaded PDF (a CV or a job post) in memory, so the model
// gets the exact characters as well as the file (D-183). Models reading a PDF as page
// images misread names, emails and figures, and mix up two column layouts. Scanned PDFs
// have no text layer: then this returns null and the file alone is read, as before.

export type PdfText = { text: string; pages: number };

type Item = { str: string; x: number; y: number; width: number; size: number };
type Line = { y: number; items: Item[] };

const MAX_PAGES = 12;
const MAX_CHARS = 60_000;

/** Groups text pieces into lines, top to bottom, left to right. */
export function toLines(items: Item[]): Line[] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const tolerance = Math.max(2, it.size * 0.45);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tolerance);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => b.y - a.y);
}

/** Joins a line's pieces, with a space where the gap between them is a word gap and three where it is a column gap. */
export function lineText(items: Item[]): string {
  let out = "";
  let end: number | null = null;
  for (const it of items) {
    if (end !== null) {
      const gap = it.x - end;
      if (gap > it.size * 1.5) out += "   ";
      else if (gap > it.size * 0.12 && !out.endsWith(" ") && !it.str.startsWith(" ")) out += " ";
    }
    out += it.str;
    end = it.x + it.width;
  }
  return out.replace(/[^\S\n]+/g, (s) => (s.length >= 3 ? "   " : " ")).trim();
}

/**
 * Finds a gutter between two real columns of text (a sidebar CV): an x position almost no
 * line crosses, with text on both sides on most lines. Right aligned dates, or a dates
 * column on the left, sit on few lines, so they stay on their role's line.
 */
export function findGutter(lines: Line[]): number | null {
  if (lines.length < 8) return null;
  const left = Math.min(...lines.flatMap((l) => l.items.map((i) => i.x)));
  const right = Math.max(...lines.flatMap((l) => l.items.map((i) => i.x + i.width)));
  const width = right - left;
  if (width <= 0) return null;
  const total = lines.reduce((s, l) => s + l.items.reduce((t, i) => t + i.str.trim().length, 0), 0);
  let best: { x: number; score: number } | null = null;
  for (let x = left + width * 0.22; x <= left + width * 0.78; x += 3) {
    let crossing = 0;
    let leftLines = 0;
    let rightLines = 0;
    let rightChars = 0;
    for (const l of lines) {
      if (l.items.some((i) => i.x < x - 1 && i.x + i.width > x + 1)) {
        crossing++;
        continue;
      }
      const r = l.items.filter((i) => i.x >= x);
      if (r.length) rightLines++;
      if (r.length < l.items.length) leftLines++;
      rightChars += r.reduce((t, i) => t + i.str.trim().length, 0);
    }
    const n = lines.length;
    const ok = crossing <= n * 0.06 && leftLines >= n * 0.4 && rightLines >= n * 0.4 && rightChars >= total * 0.12 && total - rightChars >= total * 0.12;
    if (!ok) continue;
    const score = Math.min(leftLines, rightLines) - crossing * 3;
    if (!best || score > best.score) best = { x, score };
  }
  return best?.x ?? null;
}

/** One page's text in reading order: a sidebar layout reads column by column. */
export function pageText(items: Item[]): string {
  const lines = toLines(items);
  const gutter = findGutter(lines);
  if (gutter === null) return lines.map((l) => lineText(l.items)).filter(Boolean).join("\n");
  const leftCol: string[] = [];
  const rightCol: string[] = [];
  for (const l of lines) {
    const crosses = l.items.some((i) => i.x < gutter - 1 && i.x + i.width > gutter + 1);
    if (crosses) {
      leftCol.push(lineText(l.items));
      continue;
    }
    const a = lineText(l.items.filter((i) => i.x < gutter));
    const b = lineText(l.items.filter((i) => i.x >= gutter));
    if (a) leftCol.push(a);
    if (b) rightCol.push(b);
  }
  return [...leftCol, "", ...rightCol].join("\n").trim();
}

/** Whether extracted text is real words: scanned pages give none, and broken font maps give symbols. */
export function usableText(text: string): boolean {
  const visible = text.replace(/\s/g, "");
  if (visible.length < 120) return false;
  const letters = visible.match(/\p{L}/gu)?.length ?? 0;
  const latin = visible.match(/[A-Za-z]/g)?.length ?? 0;
  const broken = visible.match(/�/g)?.length ?? 0;
  return letters / visible.length >= 0.55 && latin >= letters * 0.7 && broken <= visible.length * 0.02;
}

/** The PDF's text layer in reading order, or null when it has none worth using. Never throws. */
export async function pdfText(bytes: Uint8Array, timeoutMs = 8000): Promise<PdfText | null> {
  const work = (async (): Promise<PdfText | null> => {
    const { getDocumentProxy } = await import("unpdf");
    // pdf.js may take ownership of the buffer it is given, so it gets a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    try {
      const pages: string[] = [];
      for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const items: Item[] = [];
        for (const raw of content.items) {
          if (!("str" in raw) || !raw.str) continue;
          const [a, b, c, d, e, f] = raw.transform as number[];
          items.push({ str: raw.str, x: e ?? 0, y: f ?? 0, width: raw.width, size: Math.hypot(c ?? 0, d ?? 0) || Math.hypot(a ?? 0, b ?? 0) || 10 });
        }
        pages.push(pageText(items));
      }
      const text = pages.join("\n\n").replace(/\n{3,}/g, "\n\n").slice(0, MAX_CHARS).trim();
      return usableText(text) ? { text, pages: pdf.numPages } : null;
    } finally {
      // Frees pdf.js memory; not every build has it.
      await Promise.resolve((pdf as { destroy?: () => Promise<void> }).destroy?.()).catch(() => undefined);
    }
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    return await Promise.race([work.catch(() => null), timeout]);
  } catch {
    return null;
  }
}
