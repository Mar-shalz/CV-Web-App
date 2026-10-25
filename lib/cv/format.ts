// Small per-country layout choices, shared by the preview, the files and the letter. Kept
// apart from profiles.ts so the browser doesn't load the country configs.

/** North American formats print on Letter paper (US, D-168; Canada, D-198); the rest on A4. */
export const onLetterPaper = (format: string): boolean => format === "us" || format === "ca";

/** The heading over the summary, as each country's CVs name it. */
export function summaryHeading(format: string): string {
  if (format === "uk") return "Profile";
  if (format === "us" || format === "ca") return "Summary";
  return "Profile summary";
}
