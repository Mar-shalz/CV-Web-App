// Jobs found by the daily search (D-205), in one shape whatever the source.

export type FeedSource = "headcount" | "jobicy";

export type FeedJob = {
  source: FeedSource;
  sourceId: string;
  title: string;
  employer: string;
  location: string | null;
  /** ISO 3166 two letter codes the job is in, when the source says. */
  countries: string[];
  remote: boolean;
  /** When the source published it; null when it doesn't say. */
  postedAt: string | null;
  /** Where to read and apply: the employer's own page, or the source's listing when it asks for that. */
  url: string;
  description: string;
  /** Credit the source asks for next to the job. */
  credit: { text: string; link: string } | null;
};

/** Plain text from a job description that may hold HTML. Never rendered as HTML. */
export function plainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "...")
    .replace(/&ndash;|&mdash;/g, ", ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const httpsOnly = (u: unknown): string | null => (typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) ? u : null);
