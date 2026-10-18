// The CV writing standard, checked by code (D-185). The fact lock checks truth; this checks
// craft: what a recruiter or a hiring system (ATS) marks a CV down for. Problems go back to
// the CV writer once, and the better of the two drafts is kept. Nothing here adds a fact:
// a missing job term is only asked for when the person's own skills or items show it.

export type DraftForReview = {
  title_line: string;
  summary: { text: string };
  experience: { role_id: string; bullets: { text: string; source_item_ids?: string[] }[] }[];
  skills: { tools: string[]; professional: string[]; languages: string[] };
};

export type ReviewContext = {
  /** The job's requirement lines. */
  requirements: string[];
  /** Skills the person has: their list, skills added during checks, and skills on their items. */
  skills: string[];
  /** Confirmed item counts per role id, for spotting roles cut too short. */
  itemsPerRole: Record<string, number>;
  /** Each item's words (its text, the person's quote and its role heading), for spotting added claims. */
  itemText?: Record<string, string>;
  /** Everything the summary may draw on: items, education, skills, their own summary. */
  evidence?: string;
};

const WEAK_OPENER = /^(responsible for|duties (?:included|include)|helped(?: to)?|assisted (?:with|in)|worked (?:on|as)|involved in|tasked with|in charge of|participated in|was|were|did|carried out various|handled various)\b/i;
const FIRST_PERSON = /\b(I|I'm|I've|I'd|my|me|we|our)\b/;
const WISHFUL = /\b(seeking|looking for an? (?:opportunity|role|position)|to obtain|aspiring|desire to|hoping to)\b/i;
const FILLER = /\b(hardworking|hard working|highly motivated|self[- ]starter|go[- ]getter|team player|detail[- ]oriented|result[- ]oriented|excellent communication skills|various|etc)\b/i;

// Phrases that read as machine written and say nothing (live tests, round 25).
const CLICHE = /\b(demonstrated (?:\w+ )?(?:ability|capability|expertise|strength|skills?)|proven (?:ability|capability|capacity|expertise)|strong commitment|commitment to excellence|drive (?:operational )?efficiency|operational efficiency|high[- ]volume|robust|comprehensive|meticulous|adept at|keen eye|cutting[- ]edge|best[- ]in[- ]class|value[- ]added|thrives? in|ready to deliver|strict compliance|wealth of experience|in[- ]depth knowledge)\b/i;
// A purpose or result tacked on the end: "to ensure full compliance", "ensuring accuracy".
const PURPOSE = /\b(?:(?:so as )?to\s+(?:ensure|maintain|verify|guarantee|improve|drive|support|achieve|deliver|enhance|boost|meet|uphold|promote|strengthen)|ensuring|maintaining|driving|improving|enhancing|guaranteeing)\s+([^,;.]{3,80})/gi;
const STOP = new Set("about above across after again against along also among and any are around as at be been before being below between both but by can could did does doing done down during each either every few for from further had has have having her here him his how into its itself just made make many more most much must near need not now off once only onto other our out over own per same she should since some such than that the their them then there these they this those through too under until upon very was were what when where which while who whom why will with within without would you your new each daily weekly monthly using used use".split(" "));

/** Rough stem, so "banking" matches "bank" and "reconciliation" matches "reconciled". */
const stem = (w: string) => w.replace(/(ations?|ings?|ions?|ers?|ed|es|ly|al|s)$/, "").slice(0, 6);
const contentWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w));

/** Words in a line that its sources (and the job's own words) never use. */
function addedWords(line: string, source: string, allowed: string): string[] {
  const have = new Set([...contentWords(source), ...contentWords(allowed)].map(stem));
  return [...new Set(contentWords(line).filter((w) => !have.has(stem(w))))];
}

/** Purpose or result clauses in a text whose words its source doesn't hold ("ensuring that entries matched"). */
export function unsupportedPurposes(text: string, source: string, allowed = ""): string[] {
  return [...text.matchAll(PURPOSE)].filter((m) => addedWords(m[1] ?? "", source, allowed).length > 0).map((m) => m[0].trim());
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${escape(term.toLowerCase())}([^a-z0-9]|$)`).test(text.toLowerCase());

/**
 * Job terms this person can truthfully use: skills they have that the job's requirements
 * name. These are what hiring systems match on, so each should appear on the CV.
 */
export function jobTermsTheyHave(requirements: string[], skills: string[]): string[] {
  const req = requirements.join(" \n ");
  const seen = new Set<string>();
  return skills.filter((s) => {
    const k = s.trim().toLowerCase();
    if (k.length < 2 || seen.has(k) || !mentions(req, s.trim())) return false;
    seen.add(k);
    return true;
  });
}

/** The summary: proof, not wishes, in the length that gets read, with nothing the evidence doesn't hold. */
export function reviewSummary(text: string, evidence?: string): string[] {
  const s = text.trim();
  if (!s) return [];
  const issues: string[] = [];
  if (CLICHE.test(s)) issues.push(`The summary uses a stock phrase ("${CLICHE.exec(s)?.[0]}"). Replace it with proof from the items.`);
  if (evidence) {
    const purpose = [...s.matchAll(PURPOSE)].find((m) => addedWords(m[1] ?? "", evidence, "").length > 1);
    if (purpose) issues.push(`The summary claims something the evidence doesn't show ("${purpose[0].trim()}"). Keep to the evidence.`);
  }
  const n = words(s);
  if (n < 50) issues.push(`The summary is short (${n} words). Write 4 to 5 sentences, 75 to 115 words.`);
  if (n > 135) issues.push(`The summary is long (${n} words). Keep it to 75 to 115 words.`);
  if (FIRST_PERSON.test(s)) issues.push("The summary uses the first person. Write it in the implied first person CVs use.");
  if (WISHFUL.test(s)) issues.push(`The summary says what the person wants ("${WISHFUL.exec(s)?.[0]}"). Say what they bring to this job instead.`);
  if (FILLER.test(s)) issues.push(`The summary uses filler ("${FILLER.exec(s)?.[0]}"). Replace it with proof from the items.`);
  return issues;
}

/** Problems with a draft, each written as an instruction the CV writer can act on. */
export function reviewDraft(d: DraftForReview, ctx: ReviewContext): string[] {
  const issues: string[] = [];
  const bullets = d.experience.flatMap((e) => e.bullets.map((b) => ({ role: e.role_id, text: b.text.trim() })));

  const allowed = [...ctx.requirements, ...ctx.skills].join(" ");
  for (const e of d.experience) {
    for (const b of e.bullets) {
      if (!ctx.itemText || !b.source_item_ids?.length) continue;
      const source = b.source_item_ids.map((id) => ctx.itemText?.[id] ?? "").join(" ");
      if (!source.trim()) continue;
      // Added claims: a purpose or result the items don't state, or several new words.
      const purpose = [...b.text.matchAll(PURPOSE)].find((m) => addedWords(m[1] ?? "", source, allowed).length > 0);
      const extra = addedWords(b.text.split(/\s+/).slice(1).join(" "), source, allowed);
      if (purpose) issues.push(`Bullet "${b.text.trim()}" adds a purpose its items don't state ("${purpose[0].trim()}"). Remove it, or use the items' own words.`);
      else if (extra.length >= 3) issues.push(`Bullet "${b.text.trim()}" adds words its items don't support (${extra.slice(0, 6).join(", ")}). Keep to what the items say.`);
    }
  }

  for (const b of bullets) {
    const n = words(b.text);
    if (CLICHE.test(b.text)) issues.push(`Bullet "${b.text}" uses a stock phrase ("${CLICHE.exec(b.text)?.[0]}"). Say what was done instead.`);
    if (WEAK_OPENER.test(b.text)) issues.push(`Bullet "${b.text}" opens weakly. Start with a strong past tense action verb that says what was done.`);
    else if (FIRST_PERSON.test(b.text)) issues.push(`Bullet "${b.text}" uses the first person. CV lines never say I, my or we.`);
    if (n < 9) issues.push(`Bullet "${b.text}" is thin (${n} words). Add the how, the scope or the result from its cited items, if they give one.`);
    if (n > 38) issues.push(`Bullet "${b.text}" is too long (${n} words). Keep it to two lines, 16 to 30 words.`);
    if (FILLER.test(b.text)) issues.push(`Bullet "${b.text}" uses filler ("${FILLER.exec(b.text)?.[0]}"). Show it with a fact instead.`);
  }

  // Verb variety: the same opener twice in a row in a role, or many times across the CV.
  for (const e of d.experience) {
    for (let i = 1; i < e.bullets.length; i++) {
      const [a, b] = [firstWord(e.bullets[i - 1]!.text), firstWord(e.bullets[i]!.text)];
      if (a && a === b) issues.push(`Two bullets in a row start with "${a}". Vary the verbs.`);
    }
  }
  const openers = new Map<string, number>();
  for (const b of bullets) openers.set(firstWord(b.text), (openers.get(firstWord(b.text)) ?? 0) + 1);
  for (const [verb, count] of openers) if (verb && count > 3) issues.push(`"${verb}" starts ${count} bullets. Use it at most three times.`);

  // One ending for every bullet.
  const stops = bullets.filter((b) => /\.$/.test(b.text)).length;
  if (stops && stops < bullets.length) issues.push("Some bullets end with a full stop and some don't. End them all the same way.");

  // Roles with plenty of evidence cut to one or two lines.
  for (const e of d.experience) {
    const have = ctx.itemsPerRole[e.role_id] ?? 0;
    if (have >= 3 && e.bullets.length < 3) issues.push(`Role ${e.role_id} has ${have} confirmed items but only ${e.bullets.length} bullet${e.bullets.length === 1 ? "" : "s"}. Use more of its evidence when it fits this job.`);
  }

  const s = d.summary.text.trim();
  issues.push(...reviewSummary(s, ctx.evidence ? `${ctx.evidence} ${allowed}` : undefined));

  // Hiring systems match the job's own words: each skill the person has that the job names
  // should appear somewhere on the CV.
  const cvText = [d.title_line, s, ...bullets.map((b) => b.text), ...d.skills.tools, ...d.skills.professional, ...d.skills.languages].join(" \n ");
  const missing = jobTermsTheyHave(ctx.requirements, ctx.skills).filter((t) => !mentions(cvText, t));
  if (missing.length) issues.push(`The job asks for ${missing.map((t) => `"${t}"`).join(", ")} and the person has ${missing.length === 1 ? "it" : "them"} in their skills, but the CV never says so. Put each in the skills section with the job's exact words, and in a line where a cited item shows it.`);

  return [...new Set(issues)].slice(0, 20);
}
