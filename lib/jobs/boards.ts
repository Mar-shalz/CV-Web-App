import "server-only";
import { htmlToText } from "./fetch-link";

/**
 * Direct readers for the job boards people paste most (D-117). Each one uses the board's
 * own public, no-login feed for a single post, so a link that "needs a login" in a
 * browser (LinkedIn) or that draws the page with JavaScript (Workable, Ashby) still
 * gives us the advert's own words. Hosts are fixed here, so no user URL is fetched
 * directly by these readers.
 *
 * Returns null when the link isn't one of these boards, "closed" when the board says
 * the post no longer exists, or the post's text.
 */
export type BoardRead = { ok: true; text: string; finalUrl: string; board: string } | { ok: false; reason: "closed"; board: string } | null;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

async function get(url: string, accept = "application/json"): Promise<Response | null> {
  try {
    return await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": UA, accept } });
  } catch {
    return null;
  }
}

const join = (...parts: (string | null | undefined | false)[]) =>
  parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join("\n")
    .trim();

/** Greenhouse HTML comes entity-encoded inside JSON. */
function decode(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function greenhouse(u: URL): Promise<BoardRead> {
  if (!/(^|\.)greenhouse\.io$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  const board = m?.[1] ?? u.searchParams.get("for");
  const id = m?.[2] ?? u.searchParams.get("token") ?? u.searchParams.get("gh_jid");
  if (!board || !id) return null;
  const res = await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}`);
  if (!res) return null;
  if (res.status === 404) return { ok: false, reason: "closed", board: "Greenhouse" };
  if (!res.ok) return null;
  const d = (await res.json()) as { title?: string; company_name?: string; location?: { name?: string }; content?: string; absolute_url?: string };
  if (!d.title || !d.content) return null;
  const text = join(d.title, d.company_name ? `Employer: ${d.company_name}` : `Employer: ${board}`, d.location?.name ? `Location: ${d.location.name}` : null, htmlToText(decode(d.content)));
  return { ok: true, text, finalUrl: d.absolute_url ?? u.toString(), board: "Greenhouse" };
}

async function lever(u: URL): Promise<BoardRead> {
  const eu = /^jobs\.eu\.lever\.co$/i.test(u.hostname);
  if (!eu && !/^jobs\.lever\.co$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const res = await get(`https://api${eu ? ".eu" : ""}.lever.co/v0/postings/${encodeURIComponent(m[1]!)}/${m[2]}`);
  if (!res) return null;
  if (res.status === 404) return { ok: false, reason: "closed", board: "Lever" };
  if (!res.ok) return null;
  const d = (await res.json()) as {
    text?: string;
    categories?: { location?: string; team?: string; commitment?: string };
    descriptionPlain?: string;
    lists?: { text?: string; content?: string }[];
    additionalPlain?: string;
    hostedUrl?: string;
  };
  if (!d.text) return null;
  const lists = (d.lists ?? []).map((l) => join(l.text, htmlToText(l.content ?? ""))).join("\n\n");
  const text = join(d.text, `Employer: ${m[1]}`, d.categories?.location ? `Location: ${d.categories.location}` : null, d.categories?.commitment, d.descriptionPlain, lists, d.additionalPlain);
  return { ok: true, text, finalUrl: d.hostedUrl ?? u.toString(), board: "Lever" };
}

async function ashby(u: URL): Promise<BoardRead> {
  if (!/^jobs\.ashbyhq\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const res = await get(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(m[1]!)}`);
  if (!res?.ok) return null;
  const d = (await res.json()) as { jobs?: { id: string; title?: string; location?: string; employmentType?: string; descriptionPlain?: string; jobUrl?: string }[] };
  const job = d.jobs?.find((j) => j.id === m[2]);
  if (!job) return { ok: false, reason: "closed", board: "Ashby" };
  const text = join(job.title, `Employer: ${m[1]}`, job.location ? `Location: ${job.location}` : null, job.employmentType, job.descriptionPlain);
  return { ok: true, text, finalUrl: job.jobUrl ?? u.toString(), board: "Ashby" };
}

async function workable(u: URL): Promise<BoardRead> {
  if (!/^apply\.workable\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/j\/([A-Z0-9]+)/i);
  if (!m) return null;
  const res = await get(`https://apply.workable.com/api/v2/accounts/${encodeURIComponent(m[1]!)}/jobs/${encodeURIComponent(m[2]!)}`);
  if (!res) return null;
  if (res.status === 404) return { ok: false, reason: "closed", board: "Workable" };
  if (!res.ok) return null;
  const d = (await res.json()) as { title?: string; location?: { city?: string; country?: string }; description?: string; requirements?: string; benefits?: string };
  if (!d.title) return null;
  const place = [d.location?.city, d.location?.country].filter(Boolean).join(", ");
  const text = join(
    d.title,
    `Employer: ${m[1]}`,
    place ? `Location: ${place}` : null,
    htmlToText(d.description ?? ""),
    d.requirements ? `Requirements\n${htmlToText(d.requirements)}` : null,
    d.benefits ? `Benefits\n${htmlToText(d.benefits)}` : null,
  );
  return { ok: true, text, finalUrl: u.toString(), board: "Workable" };
}

async function smartRecruiters(u: URL): Promise<BoardRead> {
  if (!/^(jobs|careers)\.smartrecruiters\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([^/]+)\/(\d{6,})/);
  if (!m) return null;
  const res = await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(m[1]!)}/postings/${m[2]}`);
  if (!res) return null;
  if (res.status === 404) return { ok: false, reason: "closed", board: "SmartRecruiters" };
  if (!res.ok) return null;
  const d = (await res.json()) as { name?: string; company?: { name?: string }; location?: { city?: string; country?: string }; jobAd?: { sections?: Record<string, { title?: string; text?: string }> } };
  if (!d.name) return null;
  const sections = Object.values(d.jobAd?.sections ?? {})
    .map((s) => join(s.title, htmlToText(s.text ?? "")))
    .join("\n\n");
  const place = [d.location?.city, d.location?.country].filter(Boolean).join(", ");
  const text = join(d.name, d.company?.name ? `Employer: ${d.company.name}` : null, place ? `Location: ${place}` : null, sections);
  return { ok: true, text, finalUrl: u.toString(), board: "SmartRecruiters" };
}

/** The LinkedIn job id from any of its link shapes: /jobs/view/123, /jobs/view/title-at-co-123, ?currentJobId=123. */
export function linkedInJobId(u: URL): string | null {
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const q = u.searchParams.get("currentJobId") ?? u.searchParams.get("jobId");
  if (q && /^\d{6,}$/.test(q)) return q;
  const m = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})\/?$/) ?? u.pathname.match(/\/jobs\/view\/(\d{6,})/);
  return m?.[1] ?? null;
}

/** LinkedIn's guest job page: the same HTML a signed-out visitor sees, without the sign-in wall. */
async function linkedIn(u: URL): Promise<BoardRead> {
  const id = linkedInJobId(u);
  if (!id) return null;
  const res = await get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, "text/html");
  if (!res) return null;
  if (res.status === 404 || res.status === 410) return { ok: false, reason: "closed", board: "LinkedIn" };
  if (!res.ok) return null;
  const html = await res.text();
  const pick = (cls: string) => {
    const m = html.match(new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</(?:h1|h2|h3|a|span|div|section)>`));
    return m
      ? htmlToText(m[1] ?? "")
          .replace(/\s+/g, " ")
          .trim()
      : null;
  };
  const title = pick("top-card-layout__title");
  const org = pick("topcard__org-name-link") ?? pick("topcard__flavor");
  const place = pick("topcard__flavor--bullet");
  const bodyStart = html.search(/class="[^"]*show-more-less-html__markup/);
  const body = bodyStart >= 0 ? htmlToText(html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</div>", bodyStart))) : "";
  const criteria = [...html.matchAll(/description__job-criteria-subheader[^>]*>([\s\S]*?)<\/h3>[\s\S]*?description__job-criteria-text[^>]*>([\s\S]*?)<\/span>/g)].map((c) =>
    `${htmlToText(c[1] ?? "")}: ${htmlToText(c[2] ?? "")}`.replace(/\s+/g, " "),
  );
  if (!title || body.length < 80) return null;
  if (/no longer accepting applications/i.test(html) && body.length < 200) return { ok: false, reason: "closed", board: "LinkedIn" };
  const text = join(title, org ? `Employer: ${org}` : null, place ? `Location: ${place}` : null, body, criteria.join("\n"));
  return { ok: true, text, finalUrl: `https://www.linkedin.com/jobs/view/${id}/`, board: "LinkedIn" };
}

export async function readKnownBoard(raw: string): Promise<BoardRead> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  for (const reader of [linkedIn, greenhouse, lever, ashby, workable, smartRecruiters]) {
    const r = await reader(u);
    if (r) return r;
  }
  return null;
}
