import freeEmail from "@/config/lists/free_email_domains.json";
import gov from "@/config/lists/government_agencies.json";
import lists from "@/config/lists/scam_signals.json";
import type { ParsedJob } from "@/lib/jobs/schema";

// Scam check Layer 1 (Build pack section 9). Pure rules over the post text and the
// parsed job, so it runs in the browser too and works offline. Copy describes the
// post, never the company.

export type Severity = "red" | "amber" | "info";
export type Signal = { id: string; severity: Severity; text: string; evidence: string | null };

const lc = (s: string) => s.toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = value.lastIndexOf("@");
  if (at >= 0) return lc(value.slice(at + 1)).trim();
  try {
    return lc(new URL(value.startsWith("http") ? value : `https://${value}`).hostname).replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The sentence around a match, as evidence from the post's own words. */
function around(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1, index - 120);
  const endDot = text.indexOf(".", index + length);
  const end = Math.min(text.length, endDot === -1 ? index + length + 120 : endDot + 1, index + length + 160);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function find(text: string, phrases: string[]): { phrase: string; evidence: string } | null {
  for (const p of phrases) {
    const m = new RegExp(`\\b${esc(lc(p))}\\b`, "i").exec(text);
    if (m) return { phrase: p, evidence: around(text, m.index, m[0].length) };
  }
  return null;
}

export function matchAgency(name: string | null | undefined) {
  if (!name) return null;
  const l = lc(name);
  return gov.agencies.find((a) => l.includes(lc(a.name)) || a.aliases.some((x) => new RegExp(`\\b${esc(lc(x))}\\b`).test(l))) ?? null;
}

const isFree = (host: string | null) => Boolean(host && freeEmail.domains.includes(host));
const isOfficialGovHost = (host: string | null, domains: string[]) => Boolean(host && domains.some((d) => host === d || host.endsWith(`.${d}`)));

export function layer1(text: string, job: ParsedJob): Signal[] {
  const t = text ?? "";
  const signals: Signal[] = [];
  const agency = matchAgency(job.employer_name);
  const contactHosts = [job.how_to_apply.email, ...job.contacts.emails].map(hostOf).filter((h): h is string => Boolean(h));
  const applyHost = hostOf(job.how_to_apply.url);
  const hasWhatsApp = /whats\s?app|wa\.me|telegram|t\.me\//i.test(t) || job.how_to_apply.channel === "whatsapp";

  // L1-01 Asks for money: payment words near an amount or account details.
  const pay = new RegExp(`\\b(${lists.payment_words.map(esc).join("|")})\\b[^.]{0,80}?(₦|naira|ngn|\\bn\\s?\\d|\\d{1,3}(,\\d{3})+|\\d{4,}|account (number|no))`, "i").exec(t);
  if (pay || (job.payment_mentioned.mentioned && job.payment_mentioned.quote)) {
    signals.push({
      id: "L1-01",
      severity: "red",
      text: "This post asks for a payment. Real employers don't charge you to apply, train or get a medical. Don't pay.",
      evidence: pay ? around(t, pay.index, pay[0].length) : job.payment_mentioned.quote,
    });
  }

  // L1-02 Bank account in the post: a 10 digit number together with a bank name.
  const acct = /\b\d{10}\b/.exec(t.replace(/(\d)[\s-](?=\d)/g, "$1"));
  const bank = find(t, lists.banks);
  if (acct && bank) signals.push({ id: "L1-02", severity: "red", text: "This post shows a bank account number. Employers don't ask applicants to pay into an account.", evidence: bank.evidence });

  // L1-03 Free email for a large organisation or government body.
  const freeContact = contactHosts.find(isFree);
  const looksLarge = Boolean(agency) || Boolean(job.employer_domain_claimed) || lists.large_employer_words.some((w) => lc(job.employer_name ?? "").includes(w));
  if (freeContact && looksLarge) {
    signals.push({
      id: "L1-03",
      severity: agency ? "red" : "amber",
      text: agency
        ? `A government agency asking for applications to a ${freeContact} address is a common sign of fake recruitment.`
        : `The contact is a free ${freeContact} address. Big employers usually use their own email. Check the official website first.`,
      evidence: [job.how_to_apply.email, ...job.contacts.emails].find((e) => hostOf(e) === freeContact) ?? null,
    });
  }

  // L1-04 Government recruitment off official channels.
  if (agency) {
    const routes = [applyHost, ...contactHosts].filter((h): h is string => Boolean(h));
    const offChannel = hasWhatsApp || routes.some((h) => !isOfficialGovHost(h, agency.domains) && !gov.official_tlds.some((tld) => h.endsWith(tld)));
    if (offChannel) {
      signals.push({
        id: "L1-04",
        severity: "red",
        text: `${agency.aliases[0] ?? agency.name} recruits through its official website, not through social media, WhatsApp or other sites. Check ${agency.domains[0]} before you share anything.`,
        evidence: job.how_to_apply.url ?? job.how_to_apply.email ?? null,
      });
    }
  }

  // L1-05 Lookalike website: employer name plus recruitment words, not a known domain.
  const nameToken = lc(job.employer_name ?? "").replace(/[^a-z0-9 ]/g, "").split(/\s+/).find((w) => w.length >= 4);
  for (const h of [applyHost, ...contactHosts]) {
    if (!h || !nameToken || isFree(h)) continue;
    const known = (agency?.domains ?? []).concat(job.employer_domain_claimed ? [lc(job.employer_domain_claimed)] : []);
    if (h.includes(nameToken) && /recruit|career|portal|jobs?|apply|employment|vacanc/.test(h) && !known.some((d) => h === d || h.endsWith(`.${d}`))) {
      signals.push({ id: "L1-05", severity: agency ? "red" : "amber", text: `The address ${h} looks like the employer's name with extra words. Fake job sites often do this.`, evidence: h });
      break;
    }
  }

  // L1-06 Chat apps only.
  if (hasWhatsApp && !contactHosts.some((h) => !isFree(h)) && !applyHost) {
    signals.push({ id: "L1-06", severity: "amber", text: "The only way to apply is WhatsApp or Telegram, with no company email or website.", evidence: find(t, ["whatsapp", "telegram"])?.evidence ?? null });
  }

  // L1-07 Sensitive data too early. L1-08 NIN or passport before an offer.
  const secret = find(t, ["bvn", "bank verification number", "atm pin", "bank pin", "card pin", "your pin", "otp", "one time password", "card details", "card number", "your password", "email password"]);
  if (secret) signals.push({ id: "L1-07", severity: "red", text: "This post asks for your BVN, a PIN, an OTP, card details or a password. Never share these with an employer.", evidence: secret.evidence });
  const ids = find(t, ["nin", "national identification number", "international passport", "passport data page"]);
  if (ids) signals.push({ id: "L1-08", severity: "amber", text: "This post asks for your NIN or passport before any offer. Share ID documents only after a real offer.", evidence: ids.evidence });

  // L1-09 Pressure. L1-10 Odd interview venue. L1-11 Guaranteed job or visa.
  const pressure = find(t, lists.pressure_phrases);
  if (pressure) signals.push({ id: "L1-09", severity: "amber", text: "The post pushes you to act very fast. Scams use pressure so you don't stop to check.", evidence: pressure.evidence });
  const venue = find(t, ["hotel", "private residence", "guest house", "lodge"]);
  if (venue && /interview|screening|test|meeting/i.test(t)) {
    const withMoney = signals.some((s) => s.id === "L1-01");
    signals.push({ id: "L1-10", severity: withMoney ? "red" : "amber", text: "The interview is at a hotel or private home. Real employers usually interview at their office or online.", evidence: venue.evidence });
  }
  const guarantee = find(t, lists.guarantee_phrases);
  if (guarantee) signals.push({ id: "L1-11", severity: "red", text: "The post promises a job or visa without a real selection process. That is a known scam pattern.", evidence: guarantee.evidence });

  // L1-12 Pay far above the band [Hypothesis threshold].
  const monthly = job.salary.max ?? job.salary.min;
  if (monthly && (job.salary.currency ?? "").match(/₦|ngn|^n$/i)) {
    const perMonth = job.salary.period === "year" ? monthly / 12 : job.salary.period === "week" ? monthly * 4.3 : job.salary.period === "day" ? monthly * 22 : monthly;
    const limit = (lists.pay_threshold_monthly_ngn as Record<string, number>)[job.experience_level] ?? lists.pay_threshold_monthly_ngn.unknown;
    if (perMonth > limit) signals.push({ id: "L1-12", severity: "amber", text: "The pay is far above what this kind of role usually offers. Check that it's real before you share personal details.", evidence: null });
  }

  // "Our client" alone is information, not a flag; with a money or ID request it becomes amber.
  if (job.employer_is_agency_client) {
    const risky = signals.some((s) => ["L1-01", "L1-07", "L1-08"].includes(s.id));
    signals.push({
      id: "L1-00",
      severity: risky ? "amber" : "info",
      text: risky ? "The employer isn't named, and the post asks for money or ID. Be extra careful." : "The employer isn't named. That's common in Nigerian adverts from recruiters.",
      evidence: null,
    });
  }
  return signals;
}
