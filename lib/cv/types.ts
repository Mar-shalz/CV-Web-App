import type { Flag } from "@/lib/rules/fact-lock";
import type { ProfileId } from "@/lib/rules/destination";

export type FlagStatus = "open" | "fixed" | "removed" | "kept";
export type CvFlag = Flag & { status: FlagStatus };

export type CvBullet = {
  id: string;
  text: string;
  sourceItemIds: string[];
  rewriteType: "kept" | "reworded" | "reordered" | "merged";
  flags: CvFlag[];
  /** The person's own words for the first cited item, for "Use my original wording". */
  original: string;
  sourceQuote: string | null;
};

export type CvRoleBlock = {
  roleId: string;
  title: string;
  organisation: string | null;
  location: string | null;
  dates: string;
  grade: string | null;
  bullets: CvBullet[];
};

/** A qualification or record line: title and dates on one line, where and detail below. */
export type CvEntry = { title: string; subtitle: string | null; dates: string | null; detail: string | null };

export type CvSection =
  | { key: string; heading: string; kind: "roles"; roles: CvRoleBlock[] }
  | { key: string; heading: string; kind: "entries"; entries: CvEntry[] }
  | { key: string; heading: string; kind: "lines"; lines: string[] };

export type CvDoc = {
  format: ProfileId;
  profileVersion: string;
  name: string;
  contactLine: string;
  titleLine: string;
  titleFlags: CvFlag[];
  summary: { text: string; sourceItemIds: string[]; flags: CvFlag[] };
  sections: CvSection[];
  /** Sensitive fields go on only with consent for this export; values are decrypted at export time, never stored here. */
  include: { date_of_birth: boolean; gender: boolean; state_of_origin: boolean };
  fileBase: string;
  jobTitle: string;
};

export function openFlags(doc: CvDoc): number {
  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  return [...bullets.flatMap((b) => b.flags), ...doc.summary.flags, ...doc.titleFlags].filter((f) => f.status === "open").length;
}
