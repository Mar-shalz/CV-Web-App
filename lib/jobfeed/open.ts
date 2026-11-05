import "server-only";
import closed from "@/config/lists/closed_job.json";

// Is a job on someone's list still taking applications? (founder round 42, D-213.) Asked of
// the source that knows best: Headcount's own record for jobs it found (it reads employers'
// pages and tries the application link), then the employer's job board where it has a
// public record (Workday, Greenhouse, Lever, SmartRecruiters, Ashby), then the page itself.
// "open" means the job is still listed; "unknown" when nothing could tell, so we never say
// it's listed when we don't know. The link comes from a job feed, so it's untrusted: https
// only, public hosts only, a few redirects at most.

export type OpenState = "open" | "closed" | "unknown";

const PHRASES = closed.phrases;
const TIMEOUT = 8_000;

/** A public https address, not an IP literal or a local name. */
export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
    return u;
  } catch {
    return null;
  }
}

async function get(raw: string, accept = "text/html,application/json"): Promise<{ status: number; url: string; text: string } | null> {
  let url = safeUrl(raw);
  for (let hop = 0; url && hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; AptbrixJobCheck/1.0)" }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      url = next ? safeUrl(new URL(next, url).toString()) : null;
      continue;
    }
    if (Number(res.headers.get("content-length") ?? 0) > 3_000_000) return { status: res.status, url: url.toString(), text: "" };
    return { status: res.status, url: url.toString(), text: (await res.text().catch(() => "")).slice(0, 1_500_000) };
  }
  return null;
}

type HcPosting = { posting_status?: string; latest_application_check?: { result?: string } | null };
type HcRecord = { currentness?: string; postings?: HcPosting[] };

/** Headcount's record of one job: withdrawn, not current, delisted everywhere or its application closed. */
export function readHeadcount(status: number, body: unknown): OpenState {
  if (status === 404 || status === 410) return "closed";
  if (status !== 200) return "unknown";
  const j = ((body as { data?: HcRecord } | null)?.data ?? body) as HcRecord | null;
  const postings = j?.postings ?? [];
  if (j?.currentness === "not_current") return "closed";
  if (postings.length && postings.every((p) => p.posting_status === "no_longer_listed")) return "closed";
  const listed = postings.filter((p) => p.posting_status !== "no_longer_listed");
  if (listed.length && listed.every((p) => p.latest_application_check?.result === "closed")) return "closed";
  return j?.currentness === "current" ? "open" : "unknown";
}

/** The job board's own public record of this job, when the link is on one we know. */
export function boardApi(raw: string): { url: string; read: (status: number, body: string) => OpenState } | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const gone = (status: number): OpenState => (status === 404 || status === 410 ? "closed" : status === 200 ? "open" : "unknown");

  // Workday: /[locale/]{site}/job/{...} has a JSON twin under /wday/cxs/{tenant}/{site}/.
  if (host.endsWith(".myworkdayjobs.com")) {
    const at = parts.indexOf("job");
    if (at < 1) return null;
    const site = parts[at - 1]!;
    const tenant = host.split(".")[0]!;
    return {
      url: `https://${host}/wday/cxs/${tenant}/${site}/${parts.slice(at).join("/")}`,
      read: (status, body) => {
        if (status !== 200) return gone(status);
        try {
          const info = (JSON.parse(body) as { jobPostingInfo?: { canApply?: boolean; posted?: boolean } }).jobPostingInfo;
          if (!info) return "unknown";
          return info.canApply === false || info.posted === false ? "closed" : "open";
        } catch {
          return "unknown";
        }
      },
    };
  }
  // Greenhouse: {board}/jobs/{id}
  if ((host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") && parts[1] === "jobs" && /^\d+$/.test(parts[2] ?? "")) {
    return { url: `https://boards-api.greenhouse.io/v1/boards/${parts[0]}/jobs/${parts[2]}`, read: gone };
  }
  // Lever: {company}/{id}
  if ((host === "jobs.lever.co" || host === "jobs.eu.lever.co") && parts.length >= 2) {
    return { url: `https://${host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co"}/v0/postings/${parts[0]}/${parts[1]}`, read: gone };
  }
  // SmartRecruiters: {company}/{id}-{title}
  if (host === "jobs.smartrecruiters.com" && parts.length >= 2 && /^\d+/.test(parts[1]!)) {
    return { url: `https://api.smartrecruiters.com/v1/companies/${parts[0]}/postings/${/^\d+/.exec(parts[1]!)![0]}`, read: gone };
  }
  return null;
}

/** An employer's or job board's page: gone, marked unlisted, or saying the job has closed. */
export function readPage(status: number, html: string): OpenState {
  if (status === 404 || status === 410) return "closed";
  if (status !== 200) return "unknown";
  if (/"isListed"\s*:\s*false/.test(html)) return "closed";
  if (/"isListed"\s*:\s*true/.test(html)) return "open";
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").toLowerCase().replace(/\s+/g, " ");
  return PHRASES.some((p) => text.includes(p)) ? "closed" : "open";
}

export async function stillOpen(job: { source: string; sourceId: string; url: string }): Promise<OpenState> {
  try {
    const key = process.env.HEADCOUNT_API_KEY;
    if (job.source === "headcount" && key) {
      const res = await fetch(`https://api.headcountlabs.com/v1/jobs/${encodeURIComponent(job.sourceId)}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" }).catch(() => null);
      const state = res ? readHeadcount(res.status, res.status === 200 ? await res.json().catch(() => null) : null) : "unknown";
      if (state !== "unknown") return state;
    }
    const board = boardApi(job.url);
    if (board) {
      const res = await get(board.url, "application/json");
      const state = res ? board.read(res.status, res.text) : "unknown";
      if (state !== "unknown") return state;
    }
    const page = await get(job.url);
    if (!page) return "unknown";
    // Sent somewhere else: a job board we can ask (a jobs feed's link to a Workday job), a
    // board's "job not found" (Greenhouse adds error=true), or the careers home page, which
    // says nothing about this job.
    if (page.url !== safeUrl(job.url)?.toString()) {
      const moved = boardApi(page.url);
      if (moved) {
        const res = await get(moved.url, "application/json");
        const state = res ? moved.read(res.status, res.text) : "unknown";
        if (state !== "unknown") return state;
      }
      if (/[?&]error=true\b/.test(page.url)) return "closed";
      if (new URL(page.url).pathname.split("/").filter(Boolean).length < 2) return "unknown";
    }
    return readPage(page.status, page.text);
  } catch {
    return "unknown";
  }
}
