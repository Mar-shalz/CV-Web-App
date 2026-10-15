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
  /**
   * A rewording the person hasn't accepted yet (D-163). Suggestions only take effect when
   * accepted: until then the CV file uses `original`. Missing on CVs from before D-163 (accepted).
   */
  pending?: boolean;
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
  /**
   * The summary for this job, suggested from the person's own (`own`, D-163). It goes on the
   * CV file once they confirm it; until then their own summary is used. `confirmed` is
   * missing on CVs from before D-163 (treated as confirmed).
   */
  summary: { text: string; sourceItemIds: string[]; flags: CvFlag[]; own?: string | null; confirmed?: boolean };
  sections: CvSection[];
  /** Sensitive fields go on only with consent for this export; values are decrypted at export time, never stored here. */
  include: { date_of_birth: boolean; gender: boolean; state_of_origin: boolean };
  fileBase: string;
  jobTitle: string;
};

/** Suggestions still waiting for a yes: reworded lines, and the summary (D-163). */
export function pendingSuggestions(doc: CvDoc): { lines: number; summary: boolean } {
  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  return { lines: bullets.filter((b) => b.pending).length, summary: Boolean(doc.summary.text && doc.summary.confirmed === false) };
}

/**
 * What goes in the file: accepted suggestions only (D-163). A reworded line not yet
 * accepted prints in the person's own words; an unconfirmed summary prints as their own
 * summary (or is left out when they have none).
 */
export function finalDoc(doc: CvDoc): CvDoc {
  return {
    ...doc,
    summary: doc.summary.confirmed === false ? { ...doc.summary, text: doc.summary.own ?? "" } : doc.summary,
    sections: doc.sections.map((s) => (s.kind === "roles" ? { ...s, roles: s.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => (b.pending ? { ...b, text: b.original, pending: false } : b)) })) } : s)),
  };
}

export function openFlags(doc: CvDoc): number {
  const bullets = doc.sections.flatMap((s) => (s.kind === "roles" ? s.roles.flatMap((r) => r.bullets) : []));
  return [...bullets.flatMap((b) => b.flags), ...doc.summary.flags, ...doc.titleFlags].filter((f) => f.status === "open").length;
}
