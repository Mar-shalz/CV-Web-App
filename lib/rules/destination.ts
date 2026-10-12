import type { ParsedJob } from "@/lib/jobs/schema";
import markets from "@/config/markets.json";

// Destination detection (Build pack section 8). Rules first; no model call.

export type ProfileId = "ng_private" | "ng_graduate" | "uk";

export type Destination = {
  country: string;
  confidence: number;
  signals: string[];
  profile: ProfileId;
  /** 0.5 to 0.8: ask once with the two most likely countries. */
  ask: boolean;
  alternatives: string[];
  /** Set when the country has no MVP format yet and the UK one stands in. */
  fallbackNote: string | null;
};

const CURRENCY: Record<string, string> = { "₦": "NG", NGN: "NG", N: "NG", "£": "GB", GBP: "GB", "$": "US", USD: "US", CAD: "CA", AED: "AE", "€": "DE", EUR: "DE", GHS: "GH", KES: "KE" };
const TLD: [RegExp, string][] = [
  [/\.ng$/, "NG"],
  [/\.(co\.)?uk$/, "GB"],
  [/\.ca$/, "CA"],
  [/\.de$/, "DE"],
  [/\.ae$/, "AE"],
  [/\.gh$/, "GH"],
  [/\.ke$/, "KE"],
  [/\.ie$/, "IE"],
  [/\.nl$/, "NL"],
];
const PHONE: [RegExp, string][] = [
  [/^\+?234|^0[789][01]\d{8}$/, "NG"],
  [/^\+?44/, "GB"],
  [/^\+?971/, "AE"],
  [/^\+?49/, "DE"],
  [/^\+?233/, "GH"],
  [/^\+?254/, "KE"],
  [/^\+?1/, "US"],
];

const label = (code: string) => markets.countries.find((c) => c.code === code)?.label ?? code;

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.lastIndexOf("@");
  if (at >= 0) return value.slice(at + 1).toLowerCase().trim();
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function tldCountry(host: string | null): string | null {
  if (!host) return null;
  for (const [re, c] of TLD) if (re.test(host)) return c;
  return null;
}

export function detectDestination(job: ParsedJob, targetMarkets: string[]): Destination {
  const votes = new Map<string, { score: number; signals: string[] }>();
  const vote = (country: string | null, strength: number, signal: string) => {
    if (!country) return;
    const v = votes.get(country) ?? { score: 0, signals: [] };
    // The strongest signal sets the base; each agreeing signal adds a little.
    v.score = v.score ? Math.min(0.98, Math.max(v.score, strength) + 0.08) : strength;
    v.signals.push(signal);
    votes.set(country, v);
  };

  if (job.location.country_code && !job.location.remote) vote(job.location.country_code, 0.95, `Job location: ${job.location.country ?? job.location.country_code}`);
  if (job.salary.currency) vote(CURRENCY[job.salary.currency.toUpperCase()] ?? CURRENCY[job.salary.currency] ?? null, 0.75, `Salary in ${job.salary.currency}`);
  for (const phone of job.contacts.phones) {
    const digits = phone.replace(/[^\d+]/g, "");
    const hit = PHONE.find(([re]) => re.test(digits));
    if (hit) vote(hit[1], 0.6, `Phone number ${hit[1] === "NG" ? "+234" : "code"} ${hit[1]}`);
  }
  const hosts = [job.employer_domain_claimed, job.how_to_apply.email, job.how_to_apply.url, ...job.contacts.emails].map(hostOf);
  for (const h of hosts) {
    const c = tldCountry(h);
    if (c) vote(c, 0.6, `Web address ending .${h?.split(".").slice(-1)[0]}`);
  }
  const rtw = job.hard_filters.find((f) => f.type === "right_to_work");
  if (rtw?.values[0]) vote(rtw.values[0].toUpperCase().slice(0, 2), 0.6, "Right to work wording");

  // Remote roles default to the employer's home country (its web domain).
  if (job.location.remote && votes.size === 0) {
    const home = tldCountry(hostOf(job.employer_domain_claimed));
    if (home) vote(home, 0.6, "Remote role: employer's home country");
  }

  const ranked = [...votes.entries()].sort((a, b) => b[1].score - a[1].score || targetMarkets.indexOf(a[0]) - targetMarkets.indexOf(b[0]));
  let country: string;
  let confidence: number;
  let signals: string[];
  if (ranked.length) {
    [country, { score: confidence, signals }] = ranked[0] as [string, { score: number; signals: string[] }];
    // A disagreeing signal of the same strength lowers confidence.
    if (ranked[1] && ranked[1][1].score >= confidence - 0.05) confidence = Math.min(confidence, 0.65);
  } else {
    country = targetMarkets[0] ?? "NG";
    confidence = 0.3;
    signals = ["No location found: using your first target market"];
  }

  const ask = confidence >= 0.5 && confidence < 0.8;
  const alternatives = [...new Set([country, ...ranked.map((r) => r[0]), ...targetMarkets])].slice(0, 2);

  let profile: ProfileId;
  let fallbackNote: string | null = null;
  if (country === "NG") profile = job.experience_level === "graduate_programme" ? "ng_graduate" : "ng_private";
  else if (country === "GB") profile = "uk";
  else {
    profile = "uk";
    fallbackNote = `We don't have a ${label(country)} format yet, so we've used our UK format, the closest we have.`;
  }
  return { country, confidence: Math.round(confidence * 100) / 100, signals, profile, ask, alternatives, fallbackNote };
}

export const PROFILE_LABELS: Record<ProfileId, string> = {
  ng_private: "Nigerian private sector",
  ng_graduate: "Nigerian graduate programme",
  uk: "UK",
};

export const countryLabel = label;
