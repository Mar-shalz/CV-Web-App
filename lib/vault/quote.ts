const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * True when a model's source quote really appears in what the user said or wrote.
 * Items whose quote can't be found are dropped: the vault only keeps the user's words.
 */
export function quoteIsFrom(quote: string, source: string): boolean {
  const q = norm(quote).replace(/[.,;:!?]+$/, "");
  return q.length >= 3 && norm(source).includes(q);
}
