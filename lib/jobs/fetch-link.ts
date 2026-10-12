import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkResult = { ok: true; text: string; finalUrl: string } | { ok: false; reason: "invalid" | "blocked" | "login" | "too_big" | "failed" };

const MAX_BYTES = 1_500_000;
const LOGIN_HOSTS = /(^|\.)(linkedin\.com|glassdoor\.com|facebook\.com|instagram\.com|x\.com|twitter\.com)$/i;

/** Private, loopback, link local and other addresses a server must never fetch for a user (SSRF guard). */
export function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivateAddress(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function safeUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && !["80", "443", ""].includes(url.port)) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) return null;
  return url;
}

/** Plain text from an HTML page: JSON-LD JobPosting description first, else the visible text. */
export function htmlToText(html: string): string {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const data = JSON.parse(m[1] ?? "");
      const items = Array.isArray(data) ? data : [data, ...(data["@graph"] ?? [])];
      const posting = items.find((x: { "@type"?: string }) => x?.["@type"] === "JobPosting");
      if (posting?.description) {
        const org = posting.hiringOrganization?.name ? `Employer: ${posting.hiringOrganization.name}\n` : "";
        return `${posting.title ?? ""}\n${org}${htmlToText(String(posting.description))}`.trim();
      }
    } catch {
      // Not valid JSON: fall through to the page text.
    }
  }
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Fetches a job link on the server. Every hop is checked against private addresses,
 * redirects are followed by hand (at most 3), and the body is capped. Pages behind a
 * login come back as "login" so the screen can ask for paste or a screenshot instead.
 */
export async function fetchJobLink(raw: string): Promise<LinkResult> {
  const first = await safeUrl(raw.trim());
  if (!first) return { ok: false, reason: "invalid" };
  let url: URL = first;
  if (LOGIN_HOSTS.test(url.hostname)) return { ok: false, reason: "login" };

  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; JobReader/1.0)", accept: "text/html,text/plain;q=0.9" },
      });
    } catch {
      return { ok: false, reason: "failed" };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      const resolved = next ? await safeUrl(new URL(next, url).toString()) : null;
      if (!resolved) return { ok: false, reason: "blocked" };
      if (LOGIN_HOSTS.test(resolved.hostname) || /login|signin|sign-in|auth/i.test(resolved.pathname)) return { ok: false, reason: "login" };
      url = resolved;
      continue;
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "login" };
    if (!res.ok || !res.body) return { ok: false, reason: "failed" };
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return { ok: false, reason: "failed" };

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, reason: "too_big" };
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    const text = type.includes("text/plain") ? html : htmlToText(html);
    if (text.length < 200 && /sign in|log in|login|create an account/i.test(text)) return { ok: false, reason: "login" };
    if (text.length < 80) return { ok: false, reason: "failed" };
    return { ok: true, text: text.slice(0, 40_000), finalUrl: url.toString() };
  }
  return { ok: false, reason: "blocked" };
}
