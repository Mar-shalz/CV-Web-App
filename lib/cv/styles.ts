// CV designs (D-142, D-153 adds Signature). All three follow the CV writing standard: one column, real text that
// applicant tracking systems read, standard headings, no tables, icons, photos or graphics.
// They differ in type, colour and the header, so people can match the employer's feel.

export const CV_STYLES = ["classic", "modern", "executive", "signature"] as const;
export type CvStyle = (typeof CV_STYLES)[number];

export const CV_STYLE_INFO: Record<CvStyle, { label: string; note: string }> = {
  classic: { label: "Classic", note: "Centred name, navy headings. Safe for any employer." },
  modern: { label: "Modern", note: "Name on the left, blue accents. Tech, startups, media." },
  executive: { label: "Executive", note: "Serif type, black only. Banks, law, government, senior roles." },
  signature: { label: "Signature", note: "A deep teal header band and teal accents. Stands out, and still reads cleanly in hiring software." },
};

export const isCvStyle = (v: unknown): v is CvStyle => typeof v === "string" && (CV_STYLES as readonly string[]).includes(v);
