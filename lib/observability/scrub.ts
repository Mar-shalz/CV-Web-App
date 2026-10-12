// Personal data scrubbing for error reports (Build pack section 3: "Sentry with personal
// data scrubbing"). Runs in beforeSend on the server, the edge and the browser, so it has
// no Node or DOM imports. Emails and phone numbers are masked wherever text can appear;
// request bodies, cookies, headers, query strings and the user object are dropped whole.
import type { Breadcrumb, ErrorEvent, Event } from "@sentry/browser";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// 10 to 15 digits, optionally led by +, with spaces, dots, dashes or brackets between them.
// Covers +234 803 123 4567, 08031234567 and foreign formats. Over-masking a long number
// in an error message is acceptable; leaking a phone number is not.
const PHONE = /(?<![\w])\+?\d(?:[\s().-]?\d){9,14}(?![\w])/g;
// An ISO date followed by an hour ("2026-10-12 14") also has 10 digits. Leave those be.
const ISO_DATE = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?!\d)/;

// Only headers that can't identify a person are kept.
const SAFE_HEADERS = new Set(["content-type", "accept", "user-agent"]);

export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, (match) => (ISO_DATE.test(match) ? match : "[phone]"));
}

/** Removes the query string and fragment, which can carry tokens or form values. */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return scrubText(cut === -1 ? url : url.slice(0, cut));
}

/** Deep copy with every string scrubbed. Depth limited so a cyclic or huge value can't hang the reporter. */
export function scrubValue<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (value === null || typeof value !== "object" || depth > 8) return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[scrubText(k)] = scrubValue(v, depth + 1);
  return out as T;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const out: Breadcrumb = { ...crumb };
  if (out.message) out.message = scrubText(out.message);
  if (out.data) {
    const data = { ...out.data };
    // fetch and xhr breadcrumbs carry request and response bodies on some SDK paths.
    delete data.body;
    delete data.request_body;
    delete data.response_body;
    if (typeof data.url === "string") data.url = scrubUrl(data.url);
    if (typeof data.from === "string") data.from = scrubUrl(data.from);
    if (typeof data.to === "string") data.to = scrubUrl(data.to);
    out.data = scrubValue(data);
  }
  return out;
}

export function scrubEvent<E extends Event>(event: E): E {
  const out: E = { ...event };

  // Who: never sent. dataCollection.userInfo is off as well, so the SDK does not attach an IP.
  delete out.user;

  if (out.request) {
    const req = { ...out.request };
    delete req.data;
    delete req.cookies;
    delete req.query_string;
    delete req.env;
    if (req.url) req.url = scrubUrl(req.url);
    if (req.headers) {
      req.headers = Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => SAFE_HEADERS.has(k.toLowerCase())),
      );
    }
    out.request = req;
  }

  if (out.message) out.message = scrubText(out.message);
  if (out.logentry) out.logentry = scrubValue(out.logentry);
  if (out.transaction) out.transaction = scrubUrl(out.transaction);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((ex) => ({
        ...ex,
        value: ex.value ? scrubText(ex.value) : ex.value,
        // Local variables can hold form input; frames keep file, function and line only.
        stacktrace: ex.stacktrace && {
          ...ex.stacktrace,
          frames: ex.stacktrace.frames?.map((frame) => {
            const copy = { ...frame };
            delete copy.vars;
            return copy;
          }),
        },
      })),
    };
  }
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  if (out.extra) out.extra = scrubValue(out.extra);
  if (out.contexts) out.contexts = scrubValue(out.contexts);
  if (out.tags) out.tags = scrubValue(out.tags);

  return out;
}

/** beforeSend hook shared by every runtime. */
export function beforeSend(event: ErrorEvent): ErrorEvent {
  return scrubEvent(event);
}
