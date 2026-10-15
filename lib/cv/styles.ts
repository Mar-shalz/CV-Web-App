// CV designs (D-142, D-153 adds Signature, D-157 typefaces). All four follow the CV writing standard: one column, real text that
// applicant tracking systems read, standard headings, no tables, icons, photos or graphics.
// They differ in type, colour and the header, so people can match the employer's feel.

export const CV_STYLES = ["classic", "modern", "executive", "signature"] as const;
export type CvStyle = (typeof CV_STYLES)[number];

/**
 * `font` is the typeface in the PDF; `wordFont` the standard one the Word file uses, so it
 * looks the same on any computer; `css` is the screen preview (system fonts only, no download).
 */
export const CV_STYLE_INFO: Record<CvStyle, { label: string; note: string; font: string; wordFont: string; css: string }> = {
  classic: { label: "Classic", note: "Centred name, navy headings. Safe for any employer.", font: "Source Sans 3", wordFont: "Calibri", css: "'Source Sans 3', Calibri, 'Segoe UI', Arial, sans-serif" },
  modern: { label: "Modern", note: "Name on the left, blue accents. Tech, startups, media.", font: "Inter", wordFont: "Arial", css: "Inter, Arial, Helvetica, sans-serif" },
  executive: { label: "Executive", note: "Serif type, black only. Banks, law, government, senior roles.", font: "Source Serif 4", wordFont: "Georgia", css: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
  signature: { label: "Signature", note: "A deep teal header band and teal accents. Stands out, and still reads cleanly in hiring software.", font: "Plus Jakarta Sans", wordFont: "Calibri", css: "'Plus Jakarta Sans', Calibri, 'Segoe UI', Arial, sans-serif" },
};

export const isCvStyle = (v: unknown): v is CvStyle => typeof v === "string" && (CV_STYLES as readonly string[]).includes(v);
