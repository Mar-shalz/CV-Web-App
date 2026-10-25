import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { Vault, VaultRole } from "@/lib/vault/data";
import type { JobView } from "@/lib/jobs/data";
import { runTask } from "@/lib/ai";
import { factLock, lockLine, type LockSource } from "@/lib/rules/fact-lock";
import { lintCopy } from "@/lib/copy-lint";
import { rangeLabel, monthLabel } from "@/lib/vault/dates";
import { EMPLOYMENT_KINDS, EMPLOYMENT_ON_CV, withTerms } from "@/lib/vault/schema";
import { PROFILES, SECTION_HEADINGS, fileBase, profileRules } from "./profiles";
import { allSkills, EMPTY_EXTRAS, type CvExtras } from "@/lib/vault/extras";
import type { CvBullet, CvDoc, CvFlag, CvRoleBlock, CvSection } from "./types";
import { jobTermsTheyHave, reviewDraft, reviewSummary } from "./quality";
import { cleanHeadline } from "./headline";

export type ContactDetails = { fullName: string | null; phone: string | null; email: string | null; city: string | null; state: string | null; linkedin: string | null; portfolio?: string | null; website?: string | null };

/** "https://www.linkedin.com/in/tolu/" reads as "linkedin.com/in/tolu" on a CV. */
export function shortUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/** Phone in +234 format (CV writing standard). Leaves non Nigerian numbers as written. */
export function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/[^\d+]/g, "");
  const local = d.startsWith("+2340") ? d.slice(5) : d.startsWith("+234") ? d.slice(4) : d.startsWith("234") ? d.slice(3) : d.startsWith("0") && d.length === 11 ? d.slice(1) : null;
  if (!local || local.length !== 10) return raw.trim();
  return `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

const EXPERIENCE_KINDS = ["job", "internship_siwes", "nysc_ppa", "volunteer", "project"];
const toFlags = (f: ReturnType<typeof lockLine>): CvFlag[] => f.map((x) => ({ ...x, status: "open" as const }));
const sortRecent = (a: VaultRole, b: VaultRole) => (a.isCurrent !== b.isCurrent ? (a.isCurrent ? -1 : 1) : (b.end ?? b.start ?? "").localeCompare(a.end ?? a.start ?? ""));

function monthsOf(r: VaultRole): number {
  if (!r.start) return 0;
  const [sy, sm] = r.start.split("-").map(Number) as [number, number];
  const end = r.isCurrent || !r.end ? new Date().toISOString().slice(0, 7) : r.end;
  const [ey, em] = end.split("-").map(Number) as [number, number];
  return Math.max(0, (ey - sy) * 12 + em - sm + 1);
}

type TailorOut = { title_line: string; summary: { text: string; source_item_ids: string[] }; experience: { role_id: string; bullets: { text: string; source_item_ids: string[]; rewrite_type: CvBullet["rewriteType"] }[] }[]; skills: { tools: string[]; professional: string[]; languages: string[] } };

/**
 * Tailors a CV: the model writes bullets from confirmed evidence; the fact lock checks
 * them; one regeneration fixes violations; anything still untraced is kept with a flag
 * (warnings never block the download). Role headers come from vault records, not the model.
 */
export async function buildCv(viewer: Viewer, job: JobView, vault: Vault, contact: ContactDetails, opts: { extraRules?: string[]; extras?: CvExtras } = {}): Promise<{ doc: CvDoc; generated: boolean; violations: string[] }> {
  const extras = opts.extras ?? EMPTY_EXTRAS;
  const profile = PROFILES[job.destination.profile];
  const roles = vault.roles.filter((r) => r.confirmed);
  const sources = new Map<string, LockSource>();
  for (const r of roles) {
    for (const i of r.items.filter((x) => x.confirmed)) {
      sources.set(i.id, {
        id: i.id,
        text: i.text,
        sourceQuote: i.sourceQuote,
        metrics: i.metrics,
        ownership: i.ownership,
        skills: i.skills,
        role: { kind: r.kind, organisation: r.organisation, title: r.title, location: r.location, start: r.start, end: r.end, grade: r.grade },
      });
    }
  }
  // Title lines and skills may draw on the whole vault, including role records with no items.
  const all: LockSource[] = [
    ...sources.values(),
    ...roles.map((r) => ({ id: `role:${r.id}`, text: [r.title, r.organisation, r.grade].filter(Boolean).join(" "), sourceQuote: null, metrics: [], ownership: "did" as const, skills: [], role: { kind: r.kind, organisation: r.organisation, title: r.title, location: r.location, start: r.start, end: r.end, grade: r.grade } })),
  ];
  // Skills from items, the person's own list and those added while checking jobs (D-162).
  const listed = allSkills(extras);
  const vaultSkills = [...new Set([...listed, ...roles.flatMap((r) => r.items.flatMap((i) => i.skills))])];
  // The person's own summary counts as their words for the summary line only.
  const ownSummary: LockSource | null = extras.summary
    ? { id: "own:summary", text: extras.summary, sourceQuote: extras.summary, metrics: [], ownership: "did", skills: [], role: { kind: "profile", organisation: null, title: null, location: null, start: null, end: null, grade: null } }
    : null;
  const workMonths = roles.filter((r) => r.kind === "job").reduce((s, r) => s + monthsOf(r), 0);
  const underTwo = workMonths < 24;
  const expRoles = roles.filter((r) => EXPERIENCE_KINDS.includes(r.kind));

  // The summary has its own focused writer (D-177), run alongside the CV writer.
  const level = workMonths < 12 ? "graduate or entry level" : workMonths < 36 ? "early career" : workMonths < 96 ? "mid level" : "senior";
  const summaryP = runTask(
    "cv_summary",
    {
      job: { title: job.parsed.title ?? "the role", employer: job.parsed.employer_name ?? "the employer", requirements: job.parsed.requirements.map((r) => r.text).slice(0, 12) },
      title_line: null,
      level,
      experience_months: workMonths,
      education: roles.filter((r) => r.kind === "education").map((r) => [r.title, r.organisation, r.grade, rangeLabel(r.start, r.end, r.isCurrent)].filter(Boolean).join(", ")).slice(0, 8),
      certifications: roles.filter((r) => r.kind === "certification" || r.kind === "licence").map((r) => [r.title, r.organisation, r.grade].filter(Boolean).join(", ")).slice(0, 10),
      items: expRoles.flatMap((r) => r.items.filter((i) => i.confirmed).map((i) => ({ id: i.id, role: [r.title, r.organisation].filter(Boolean).join(", ").slice(0, 200), text: i.text.slice(0, 400), source_quote: i.sourceQuote?.slice(0, 600) ?? null }))).slice(0, 40),
      skills: vaultSkills.slice(0, 60),
      own_summary: extras.summary,
      job_terms: jobTermsTheyHave(job.parsed.requirements.map((r) => r.text), vaultSkills).slice(0, 30),
      spelling: profile.spelling,
    },
    { userId: viewer.preview ? undefined : viewer.id },
  ).catch(() => null);

  let out: TailorOut | null = null;
  let violations: string[] = [];
  let generated = false;
  // Two checks on every draft (D-185): the fact lock (truth) and the CV standard (craft).
  // Problems go back once; the better draft is kept, truth weighing most.
  const itemText = Object.fromEntries([...sources.values()].map((x) => [x.id, [x.text, x.sourceQuote, x.role.title, x.role.organisation, x.role.location, ...x.skills].filter(Boolean).join(" ")]));
  const review = {
    requirements: job.parsed.requirements.map((r) => r.text),
    skills: vaultSkills,
    itemsPerRole: Object.fromEntries(expRoles.map((r) => [r.id, r.items.filter((i) => i.confirmed).length])),
    itemText,
    evidence: [...Object.values(itemText), ...all.map((x) => x.text), extras.summary ?? "", vaultSkills.join(" ")].join(" "),
  };
  let best: { out: TailorOut; lock: string[]; score: number } | null = null;
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await runTask(
      "tailor_cv",
      {
        profile: { label: profile.label, spelling: profile.spelling, rules: [...profileRules(profile, underTwo), ...(opts.extraRules ?? [])].slice(0, 20) },
        job: { title: job.parsed.title ?? "the role", employer: job.parsed.employer_name ?? "the employer", requirements: job.parsed.requirements.map((r) => r.text) },
        experience_months: workMonths,
        roles: expRoles.map((r) => ({
          role_id: r.id,
          kind: r.kind,
          heading: [r.title, r.organisation, rangeLabel(r.start, r.end, r.isCurrent)].filter(Boolean).join(", "),
          items: r.items.filter((i) => i.confirmed).map((i) => ({ id: i.id, text: i.text, source_quote: i.sourceQuote, ownership: i.ownership, rough_numbers: i.metrics.filter((m) => m.approximate).map((m) => m.value) })),
        })),
        education: roles.filter((r) => r.kind === "education").map((r) => [r.title, r.organisation, r.grade, rangeLabel(r.start, r.end, r.isCurrent)].filter(Boolean).join(", ")),
        certifications: roles.filter((r) => r.kind === "certification" || r.kind === "licence").map((r) => [r.title, r.organisation, r.grade].filter(Boolean).join(", ")),
        vault_skills: vaultSkills.slice(0, 90),
        own_summary: extras.summary,
        job_terms: jobTermsTheyHave(review.requirements, vaultSkills).slice(0, 30),
        previous_violations: problems.slice(0, 30),
        cacheKey: `${job.id}:${attempt}`,
      },
      { userId: viewer.preview ? undefined : viewer.id },
    );
    if (!res.ok) break;
    const draft = res.data;
    generated = true;
    // Check the draft. Problems go back once; after that, flags.
    const bullets = draft.experience.flatMap((e) => e.bullets.map((b, n) => ({ id: `${e.role_id}:${n}`, text: b.text, source_item_ids: b.source_item_ids })));
    const lock = factLock(bullets, sources);
    const next: string[] = [];
    for (const k of lock.kept) for (const f of k.flags) next.push(`Bullet "${k.text}": ${f.type} "${f.token}" is not in its cited items.`);
    for (const id of lock.dropped) next.push(`Bullet "${bullets.find((b) => b.id === id)?.text}" cites no valid item id.`);
    const sumSources = [...draft.summary.source_item_ids.map((id) => sources.get(id)).filter((s): s is LockSource => Boolean(s)), ...(ownSummary ? [ownSummary] : [])];
    for (const f of lockLine(draft.summary.text, sumSources.length ? sumSources : all)) next.push(`Summary: ${f.type} "${f.token}" is not supported.`);
    for (const f of lockLine(draft.title_line, all)) next.push(`Title line: ${f.type} "${f.token}" is not supported.`);
    const craft = reviewDraft(draft, review);
    const score = next.length * 3 + craft.length;
    if (!best || score < best.score) best = { out: draft, lock: next, score };
    // Quality first (founder, round 28): any problem, truth or craft, goes back once.
    const retry = next.length > 0 || craft.length > 0;
    if (!retry || attempt === 1) break;
    problems = [...next, ...craft];
  }
  out = best?.out ?? null;
  violations = best?.lock ?? [];

  // Manual path: the model step failed, so the CV uses the person's confirmed items as they are.
  if (!out) {
    out = {
      // A headline is a title held, never the course studied (D-198); none when there's no job yet.
      title_line: expRoles.filter((r) => r.kind === "job").sort(sortRecent)[0]?.title ?? "",
      summary: { text: extras.summary ?? "", source_item_ids: [] },
      experience: expRoles.map((r) => ({ role_id: r.id, bullets: r.items.filter((i) => i.confirmed).slice(0, 5).map((i) => ({ text: i.text, source_item_ids: [i.id], rewrite_type: "kept" as const })) })),
      skills: { tools: [], professional: vaultSkills.slice(0, 12), languages: [] },
    };
  }

  // Use the focused summary when it traces as well as the CV writer's one (D-177).
  const focused = await summaryP;
  if (focused?.ok) {
    const ids = focused.data.source_item_ids.filter((id) => sources.has(id));
    const text = focused.data.text.replace(/\s*\u2014\s*/g, ", ").trim();
    const srcs = [...ids.map((id) => sources.get(id)!), ...(ownSummary ? [ownSummary] : [])];
    const flagsNew = lockLine(text, srcs.length ? srcs : all).length;
    const oldSrcs = [...out.summary.source_item_ids.map((id) => sources.get(id)).filter((x): x is LockSource => Boolean(x)), ...(ownSummary ? [ownSummary] : [])];
    const flagsOld = out.summary.text ? lockLine(out.summary.text, oldSrcs.length ? oldSrcs : all).length : Infinity;
    // Truth first, then the CV standard (D-185): the better traced and better written one wins.
    const better = flagsNew < flagsOld || (flagsNew === flagsOld && reviewSummary(text, review.evidence).length <= reviewSummary(out.summary.text, review.evidence).length);
    if (!lintCopy(text).some((i) => i.kind === "phrase") && better) out = { ...out, summary: { text, source_item_ids: ids } };
  }

  // Assemble, with flags attached to every untraced line.
  const lockedBullets = factLock(
    out.experience.flatMap((e) => e.bullets.map((b, n) => ({ id: `${e.role_id}:${n}`, text: b.text, source_item_ids: b.source_item_ids }))),
    sources,
  );
  const kept = new Map(lockedBullets.kept.map((k) => [k.id, k]));
  const blockFor = (r: VaultRole): CvRoleBlock | null => {
    const e = out!.experience.find((x) => x.role_id === r.id);
    if (!e) return null;
    const bullets: CvBullet[] = e.bullets.flatMap((b, n) => {
      const k = kept.get(`${r.id}:${n}`);
      if (!k) return [];
      const first = sources.get(k.source_item_ids[0] ?? "");
      const original = first?.text ?? k.text;
      // A changed line is a suggestion until the person accepts it (D-163).
      const changed = b.rewrite_type !== "kept" && k.text.trim() !== original.trim();
      return [{ id: `${r.id.slice(0, 8)}-${n}`, text: k.text, sourceItemIds: k.source_item_ids.filter((id) => sources.has(id)), rewriteType: changed ? b.rewrite_type : "kept", flags: toFlags(k.flags), original, sourceQuote: first?.sourceQuote ?? null, pending: changed }];
    });
    // Part-time and contract roles say so next to the title; full time prints nothing (D-082).
    const terms = r.employmentType && EMPLOYMENT_KINDS.includes(r.kind) ? EMPLOYMENT_ON_CV[r.employmentType] : null;
    return { roleId: r.id, title: withTerms(r.title ?? "", terms), organisation: r.organisation, location: r.location, dates: rangeLabel(r.start, r.end, r.isCurrent), grade: null, bullets };
  };

  // The headline: no course, degree or class of degree, and never a title they haven't held (D-198).
  const headline = cleanHeadline(out.title_line, { jobTitle: job.parsed.title, held: expRoles.map((r) => r.title) });

  const sumSources = [...out.summary.source_item_ids.map((id) => sources.get(id)).filter((s): s is LockSource => Boolean(s)), ...(ownSummary ? [ownSummary] : [])];
  const skillsOk = (s: string) => vaultSkills.some((v) => v.toLowerCase() === s.toLowerCase()) || [...sources.values()].some((src) => `${src.text} ${src.sourceQuote ?? ""}`.toLowerCase().includes(s.toLowerCase()));
  const chosen = {
    tools: out.skills.tools.filter(skillsOk),
    professional: out.skills.professional.filter(skillsOk),
    languages: out.skills.languages.filter((l) => l.toLowerCase() === "english" || skillsOk(l)),
  };
  // Skills added while checking jobs always go on (founder, round 20); then, when the model
  // picked few, the person's own listed skills fill the section up to 12.
  const have = new Set([...chosen.tools, ...chosen.professional, ...chosen.languages].map((s) => s.toLowerCase()));
  const must = extras.addedSkills.map((a) => a.skill).filter((s) => !have.has(s.toLowerCase()) && (have.add(s.toLowerCase()), true));
  const fill = chosen.tools.length + chosen.professional.length + must.length < 6 ? extras.skills.filter((s) => !have.has(s.toLowerCase()) && (have.add(s.toLowerCase()), true)).slice(0, 12) : [];
  const skills = { ...chosen, professional: [...chosen.professional, ...must, ...fill] };

  const order = underTwo ? profile.section_order_under_2_years : profile.section_order;
  const hasLeadership = order.includes("leadership");
  const sections: CvSection[] = [];
  for (const key of order) {
    const heading = SECTION_HEADINGS[key] ?? key;
    if (key === "profile") continue; // rendered from doc.summary
    if (key === "experience" || key === "leadership") {
      const kinds = key === "leadership" ? ["volunteer"] : hasLeadership ? ["job", "internship_siwes", "nysc_ppa", "project"] : EXPERIENCE_KINDS;
      const blocks = expRoles.filter((r) => kinds.includes(r.kind)).sort(sortRecent).map(blockFor).filter((b): b is CvRoleBlock => Boolean(b && b.bullets.length));
      if (blocks.length) sections.push({ key, heading, kind: "roles", roles: blocks });
    } else if (key === "education") {
      const entries = roles
        .filter((r) => r.kind === "education")
        .sort(sortRecent)
        .map((r) => {
          const title = /\bhnd\b/i.test(r.title ?? "") && "hnd_explainer" in profile ? `${r.title} (${profile.hnd_explainer})` : (r.title ?? "Qualification");
          return { title, subtitle: [r.organisation, r.location].filter(Boolean).join(", ") || null, dates: rangeLabel(r.start, r.end, r.isCurrent) || null, detail: r.grade ? `Class of degree: ${r.grade}` : null };
        });
      if (entries.length) sections.push({ key, heading, kind: "entries", entries });
    } else if (key === "nysc") {
      const n = roles.find((r) => r.kind === "nysc_ppa");
      if (n) {
        const status = n.isCurrent ? `Serving, ends ${monthLabel(n.end) ?? "this year"}` : `Completed ${monthLabel(n.end) ?? ""}`.trim();
        const title = "nysc_explainer" in profile ? `National Youth Service Corps (${profile.nysc_explainer})` : "National Youth Service Corps (NYSC)";
        sections.push({ key, heading, kind: "entries", entries: [{ title, subtitle: [n.organisation ? `Place of primary assignment: ${n.organisation}` : null, n.location].filter(Boolean).join(", ") || null, dates: rangeLabel(n.start, n.end, n.isCurrent) || null, detail: status }] });
      }
    } else if (key === "skills") {
      const lines = [skills.professional.length ? `Core skills: ${skills.professional.join(", ")}` : null, skills.tools.length ? `Tools and software: ${skills.tools.join(", ")}` : null, skills.languages.length ? `Languages: ${skills.languages.join(", ")}` : null].filter((l): l is string => Boolean(l));
      if (lines.length) sections.push({ key, heading, kind: "lines", lines });
    } else if (key === "certifications") {
      const entries = roles
        .filter((r) => r.kind === "certification" || r.kind === "licence")
        .sort(sortRecent)
        .map((r) => ({ title: r.title ?? "Certificate", subtitle: r.organisation, dates: r.end ? monthLabel(r.end) : r.start ? monthLabel(r.start) : null, detail: r.grade }));
      if (entries.length) sections.push({ key, heading, kind: "entries", entries });
    } else if (key === "referees") {
      // Referees (D-162): named when the person added them and the format lists them, or the
      // job asks for them; otherwise "Available on request".
      const jobAsks = job.parsed.how_to_apply.required_documents.some((d) => /referee|reference/i.test(d)) || /\breferees?\b/i.test(job.rawText ?? "");
      // Nigerian employers want two or three named referees and no "available on request"
      // line (Jobberman); UK and Gulf CVs may say it; US and Canadian resumes leave referees off (D-198).
      const listThem = extras.referees.length > 0 && (profile.referees === "listed_or_left_out" || jobAsks);
      if (listThem) {
        sections.push({ key, heading, kind: "entries", entries: extras.referees.slice(0, 3).map((r) => ({ title: r.name, subtitle: [r.role, r.organisation].filter(Boolean).join(", ") || null, dates: null, detail: [r.relationship, r.phone, r.email].filter(Boolean).join(" · ") || null })) });
      } else if (profile.referees === "available_on_request") sections.push({ key, heading, kind: "lines", lines: ["Available on request"] });
    }
  }

  // At home, city and state; applying abroad, city and country.
  const place = profile.address === "city_country_relocation" ? [contact.city, "Nigeria"].filter(Boolean).join(", ") : [contact.city, contact.state].filter(Boolean).join(", ");
  const doc: CvDoc = {
    format: job.destination.profile,
    profileVersion: profile.version,
    name: contact.fullName ?? "Your Name",
    contactLine: [formatPhone(contact.phone), contact.email, place, shortUrl(contact.linkedin), shortUrl(contact.portfolio), shortUrl(contact.website)].filter(Boolean).join(" · "),
    titleLine: headline,
    titleFlags: toFlags(headline ? lockLine(headline, all) : []),
    // Suggested for this job; the person confirms it, or keeps their own (D-163).
    summary: {
      text: out.summary.text,
      sourceItemIds: sumSources.map((s) => s.id).filter((id) => id !== "own:summary"),
      flags: toFlags(out.summary.text ? lockLine(out.summary.text, sumSources.length ? sumSources : all) : []),
      own: extras.summary,
      confirmed: !out.summary.text || out.summary.text.trim() === (extras.summary ?? "").trim(),
    },
    sections,
    include: { date_of_birth: false, gender: false, state_of_origin: false },
    fileBase: fileBase(contact.fullName, job.parsed.title ?? "Role", profile.label),
    jobTitle: job.parsed.title ?? "",
  };
  return { doc, generated, violations };
}
