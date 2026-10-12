import config from "@/config/rule_sets/eligibility_v0.json";
import type { HardFilter } from "@/lib/jobs/schema";
import { formatDate } from "@/lib/format";
import type { EligibilityInput, EligibilityProfile, EligibilityResult, RuleOutcome, Education } from "./types";

// The eligibility engine (Build pack section 7). Deterministic: the model only
// extracts filters from the post; this code decides pass, fail or unknown. It never
// suggests hiding or changing anything to get past a filter.

const lc = (s: string) => s.toLowerCase().trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, word: string) => new RegExp(`(^|[^a-z])${esc(lc(word))}([^a-z]|$)`).test(lc(text));
const HND = new RegExp(config.hnd_pattern, "i");

function rankOf(map: Record<string, number>, label: string | null | undefined): number | null {
  if (!label) return null;
  const l = lc(label).replace(/\s+/g, " ");
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of keys) if (l === k || has(l, k)) return map[k] ?? null;
  return null;
}

function parseCgpa(grade: string | null): { value: number; scale: number } | null {
  if (!grade) return null;
  const m = grade.match(/(\d(?:\.\d+)?)\s*(?:\/|out of|over|on a)\s*(\d(?:\.\d+)?)/i);
  if (!m) return null;
  return { value: Number(m[1]), scale: Math.round(Number(m[2])) };
}

function classRank(e: Education): number | null {
  const direct = rankOf(config.degree_class_rank, e.grade);
  if (direct !== null) return direct;
  const c = parseCgpa(e.grade);
  const bands = c ? (config.cgpa_class_bands as unknown as Record<string, [number, number][]>)[String(c.scale)] : undefined;
  if (!c || !bands) return null;
  for (const [min, rank] of bands) if (c.value >= min) return rank;
  return null;
}

function qualificationTypes(title: string): string[] {
  const out: string[] = [];
  for (const [type, aliases] of Object.entries(config.qualification_aliases)) if (aliases.some((a) => has(title, a))) out.push(type);
  return out;
}

const isBachelor = (types: string[]) => types.some((t) => config.bachelor_types.includes(t));

function ageOn(dob: string, ref: string): number {
  const [by, bm, bd] = dob.split("-").map(Number) as [number, number, number];
  const [ry, rm, rd] = ref.split("-").map(Number) as [number, number, number];
  return ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0);
}

const months = (years: number) => Math.round(years * 12);
const yearsText = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} ${Math.floor(m / 12) === 1 ? "year" : "years"}${m % 12 ? ` ${m % 12} months` : ""}` : `${m} months`);

function canonicalSubject(name: string): string {
  const l = lc(name);
  return (config.subject_aliases as Record<string, string>)[l] ?? l;
}

function combos<T>(items: T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (items.length <= k) return [items];
  const out: T[][] = [];
  const rec = (start: number, picked: T[]) => {
    if (picked.length === k) return void out.push(picked);
    for (let i = start; i < items.length; i++) rec(i + 1, [...picked, items[i] as T]);
  };
  rec(0, []);
  return out;
}

function gender(value: string): "female" | "male" | string {
  const l = lc(value);
  if (/^(f|female|woman|women|ladies|lady)$/.test(l) || l.startsWith("female")) return "female";
  if (/^(m|male|man|men|gentlemen)$/.test(l) || l.startsWith("male")) return "male";
  return l;
}

type Rule = (f: HardFilter, p: EligibilityProfile, deadline: string | null) => Omit<RuleOutcome, "type" | "quote">;

const RULES: Record<HardFilter["type"], Rule> = {
  max_age(f, p, deadline) {
    if (f.number === null) return { result: "unknown", reason: "The post's age wording isn't clear. Read it and decide for yourself." };
    if (!p.dateOfBirth) return { result: "unknown", reason: "We need your date of birth to check the age limit. It's kept private and only used for checks like this.", needs: "date_of_birth" };
    const ref = f.date ?? deadline ?? p.today;
    const age = ageOn(p.dateOfBirth, ref);
    return age <= f.number
      ? { result: "pass", reason: `You'll be ${age} on ${formatDate(ref)}, within the limit of ${f.number}.` }
      : { result: "fail", reason: `The limit is ${f.number} on ${formatDate(ref)}. You'll be ${age} then.` };
  },

  min_degree_class(f, p) {
    const required = Math.min(...f.values.map((v) => rankOf(config.degree_class_rank, v)).filter((r): r is number => r !== null));
    if (!Number.isFinite(required)) return { result: "unknown", reason: "The post's class of degree wording isn't clear." };
    const degrees = p.education.filter((e) => isBachelor(qualificationTypes(e.title)) || HND.test(e.title));
    if (!degrees.length) return { result: "unknown", reason: "Add your degree to check this.", needs: "education" };
    let best: { rank: number; label: string } | null = null;
    let hndBlocked: string | null = null;
    for (const e of degrees) {
      if (HND.test(e.title)) {
        const r = rankOf(config.hnd_grade_rank, e.grade);
        if (r === null) continue;
        if (!f.flag) {
          hndBlocked = e.grade;
          continue;
        }
        if (!best || r > best.rank) best = { rank: r, label: e.grade ?? "" };
      } else {
        const r = classRank(e);
        if (r !== null && (!best || r > best.rank)) best = { rank: r, label: e.grade ?? "" };
      }
    }
    if (best) {
      return best.rank >= required
        ? { result: "pass", reason: `Your ${best.label} meets this.` }
        : { result: "fail", reason: `The post needs at least ${f.values[0]}. Your degree is ${best.label}.` };
    }
    if (hndBlocked) return { result: "fail", reason: "The post asks for a class of degree and doesn't say an HND grade is accepted." };
    return { result: "unknown", reason: "Add your class of degree to check this.", needs: "degree_class" };
  },

  cgpa(f, p) {
    if (f.number === null) return { result: "unknown", reason: "The post's CGPA wording isn't clear." };
    const postScale = f.number2 ?? config.cgpa_default_scale;
    const cg = p.education.map((e) => parseCgpa(e.grade)).find(Boolean);
    if (!cg) return { result: "unknown", reason: "Add your CGPA and its scale (for example 3.62/5.00) to check this.", needs: "cgpa_scale" };
    if (cg.scale !== postScale) return { result: "unknown", reason: `The post uses a ${postScale}.0 scale and yours is on ${cg.scale}.0. We don't convert between scales.`, needs: "cgpa_scale" };
    return cg.value >= f.number
      ? { result: "pass", reason: `Your CGPA of ${cg.value} meets the minimum of ${f.number}.` }
      : { result: "fail", reason: `The post needs ${f.number} or above. Your CGPA is ${cg.value}.` };
  },

  degree_type(f, p) {
    if (!p.education.length) return { result: "unknown", reason: "Add your qualifications to check this.", needs: "education" };
    const listed = new Set(f.values.flatMap((v) => qualificationTypes(v).length ? qualificationTypes(v) : [v]));
    const mine = p.education.flatMap((e) => qualificationTypes(e.title));
    if (!mine.length) return { result: "unknown", reason: "We couldn't tell which qualification you hold. Check your education entries.", needs: "education" };
    const matches = (t: string) => listed.has(t) || (listed.has("Bachelor") && config.bachelor_types.includes(t));
    if (f.flag) {
      return mine.some((t) => !matches(t))
        ? { result: "pass", reason: "Your qualification isn't one the post excludes." }
        : { result: "fail", reason: `The post says it doesn't accept ${[...listed].join(" or ")}.` };
    }
    return mine.some(matches)
      ? { result: "pass", reason: "Your qualification is one the post accepts." }
      : { result: "fail", reason: `The post accepts ${[...listed].join(", ")}. Yours isn't on that list.` };
  },

  discipline(f, p) {
    if (!p.education.length) return { result: "unknown", reason: "Add your course of study to check this.", needs: "education" };
    const terms = f.values.flatMap((v) => config.discipline_synonyms.find((g) => g.includes(lc(v))) ?? [lc(v)]);
    const match = p.education.some((e) => terms.some((t) => lc(e.title).includes(t)));
    if (match) return { result: "pass", reason: "Your course matches." };
    return f.flag
      ? { result: "fail", reason: `The post says strictly ${f.values.join(" or ")}.` }
      : { result: "care", reason: `They name ${f.values.join(", ")}. If your course is related, say how in your email.` };
  },

  nysc(f, p, deadline) {
    const need = f.values[0] ?? "completed";
    const s = p.nysc.status;
    if (!s) return { result: "unknown", reason: "Tell us your NYSC status to check this.", needs: "nysc_status" };
    if (need === "serving") return s === "serving" ? { result: "pass", reason: "You're currently serving." } : { result: "fail", reason: "The post is for serving corps members only." };
    if (s === "completed") return { result: "pass", reason: "You've completed NYSC." };
    if (s === "exempted") {
      return need === "completed_or_exempted"
        ? { result: "pass", reason: "The post accepts an exemption certificate." }
        : { result: "fail", reason: "The post asks for completed NYSC and doesn't mention exemption." };
    }
    const by = deadline ?? p.today;
    if (f.flag && p.nysc.end && p.nysc.end <= by) return { result: "pass", reason: `Your service ends on ${formatDate(p.nysc.end)}, before the closing date.` };
    return { result: "fail", reason: "The post needs completed NYSC, and you're still serving." };
  },

  years_experience(f, p) {
    if (f.number === null) return { result: "unknown", reason: "The post's experience wording isn't clear." };
    const need = months(f.number);
    const counted = (f.flag ? p.months.jobsAfterNysc : p.months.jobs) + (f.values.includes("internships_count") ? p.months.internships : 0);
    if (counted >= need) return { result: "pass", reason: `You have about ${yearsText(counted)} that counts.` };
    if (counted >= need - config.experience_partly_months) return { result: "care", reason: `They ask for ${f.number} years; you have about ${yearsText(counted)}. Close: address it in your email.` };
    return { result: "fail", reason: `They ask for ${f.number} years${f.flag ? " after NYSC" : ""}. You have about ${yearsText(counted)} that counts.` };
  },

  licence(f, p) {
    const matched = p.licences.filter((l) => f.values.some((v) => lc(l.name).includes(lc(v)) || lc(v).includes(lc(l.name))));
    if (!matched.length) return { result: "unknown", reason: `Do you hold ${f.values.join(" or ")}? Add it to check this.`, needs: "licence" };
    if (matched.some((l) => l.status === "qualified")) return { result: "pass", reason: "You hold this." };
    if (matched.every((l) => l.status === "unknown")) return { result: "unknown", reason: `Is your ${matched[0]?.name} fully qualified, or still in progress?`, needs: "licence" };
    return f.flag
      ? { result: "fail", reason: `The post needs ${f.values.join(" or ")} fully qualified. Yours is still in progress.` }
      : { result: "care", reason: "Yours is in progress. Say where you are with it in your email." };
  },

  location(f, p) {
    if (!p.location || (!p.location.city && !p.location.state)) return { result: "unknown", reason: "Add the city you live in to check this.", needs: "location" };
    const mine = [p.location.city, p.location.state].filter((x): x is string => Boolean(x)).map(lc);
    const match = f.values.some((v) => mine.some((m) => m.includes(lc(v)) || lc(v).includes(m)));
    if (match) return { result: "pass", reason: "You're in the right place." };
    return f.flag
      ? { result: "care", reason: "They accept people willing to relocate. Say so in your email if you are." }
      : { result: "fail", reason: `The post needs candidates in ${f.values.join(", ")}.` };
  },

  olevel(f, p) {
    if (!p.olevel?.sittings.length) return { result: "unknown", reason: "Add your WAEC, NECO or GCE results to check this.", needs: "olevel" };
    const need = f.number ?? 5;
    const maxSittings = f.number2 ?? p.olevel.sittings.length;
    const required = f.values.map(canonicalSubject);
    const ok = combos(p.olevel.sittings, Math.min(maxSittings, p.olevel.sittings.length)).some((group) => {
      const credits = new Set<string>();
      for (const s of group) for (const sub of s.subjects) if (config.olevel_credit_grades.includes(sub.grade.toUpperCase())) credits.add(canonicalSubject(sub.name));
      return credits.size >= need && required.every((r) => credits.has(r));
    });
    return ok
      ? { result: "pass", reason: "Your O level credits meet this." }
      : { result: "fail", reason: `The post needs ${need} credits${required.length ? ` including ${f.values.join(" and ")}` : ""}${f.number2 ? ` in not more than ${f.number2} sittings` : ""}.` };
  },

  graduation_window(f, p) {
    const years = p.education.map((e) => e.graduationYear).filter((y): y is number => y !== null);
    if (!years.length) return { result: "unknown", reason: "Add when you graduated to check this.", needs: "education" };
    const y = Math.max(...years);
    const ok = (f.number === null || y >= f.number) && (f.number2 === null || y <= f.number2);
    return ok ? { result: "pass", reason: `You graduated in ${y}.` } : { result: "fail", reason: `The post is for people who graduated between ${f.number ?? "any year"} and ${f.number2 ?? "now"}. You graduated in ${y}.` };
  },

  gender(f, p) {
    if (!p.gender) return { result: "unknown", reason: "This post has a gender requirement. You can tell us, privately, to check it.", needs: "gender" };
    return f.values.some((v) => gender(v) === gender(p.gender ?? ""))
      ? { result: "pass", reason: "You meet this requirement." }
      : { result: "fail", reason: "You don't meet this requirement as written." };
  },

  right_to_work(f, p) {
    const country = (f.values[0] ?? "").toUpperCase();
    const status = p.rightToWork[country];
    if (!status) return { result: "unknown", reason: "Tell us whether you can already work there, or would need a visa.", needs: "right_to_work" };
    if (status === "yes") return { result: "pass", reason: "You have the right to work there." };
    return f.flag ? { result: "pass", reason: "You'd need sponsorship, and the post offers it." } : { result: "fail", reason: "The post needs the right to work without sponsorship." };
  },
};

export function checkEligibility({ filters, deadline, profile }: EligibilityInput): EligibilityResult {
  const outcomes: RuleOutcome[] = [];
  if (deadline) {
    outcomes.push(
      profile.today > deadline
        ? { type: "deadline", result: "fail", quote: `Closing date: ${formatDate(deadline)}`, reason: `This job closed on ${formatDate(deadline)}.` }
        : { type: "deadline", result: "pass", quote: `Closing date: ${formatDate(deadline)}`, reason: `Open until ${formatDate(deadline)}.` },
    );
  }
  for (const f of filters) outcomes.push({ type: f.type, quote: f.quote, ...RULES[f.type](f, profile, deadline) });
  const overall = outcomes.some((o) => o.result === "fail") ? "fail" : outcomes.some((o) => o.result === "unknown") ? "unknown" : "pass";
  return { ruleSetVersion: config.version, overall, outcomes };
}

export type { EligibilityProfile, EligibilityResult, RuleOutcome } from "./types";
