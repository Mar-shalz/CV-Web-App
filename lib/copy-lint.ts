import banned from "@/config/lists/banned_phrases.json";

export type CopyLintIssue = { kind: "phrase" | "character"; match: string; index: number };

/**
 * Finds banned phrases and em dashes. Used on generated text and, through
 * scripts/copy-lint.mjs, on UI copy in the repo.
 */
export function lintCopy(text: string): CopyLintIssue[] {
  const issues: CopyLintIssue[] = [];
  const lower = text.toLowerCase();
  for (const phrase of banned.phrases) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    for (const m of lower.matchAll(re)) issues.push({ kind: "phrase", match: phrase, index: m.index ?? 0 });
  }
  for (const ch of banned.characters) {
    let i = text.indexOf(ch);
    while (i !== -1) {
      issues.push({ kind: "character", match: ch, index: i });
      i = text.indexOf(ch, i + 1);
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}
