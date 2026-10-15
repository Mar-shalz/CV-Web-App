// Company names and web addresses, compared the same way everywhere in the job check.
// No server code here, so the search readers built on it can be unit tested.

const SUFFIX = /\b(inc|incorporated|ltd|limited|plc|llc|llp|group|holdings?|nigeria|nig|ng|mfb|company|co|corp|corporation|international|intl)\b\.?/g;

/** "Moniepoint Group Ltd" and "moniepoint" compare equal: lower case, no punctuation, no company suffixes. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
