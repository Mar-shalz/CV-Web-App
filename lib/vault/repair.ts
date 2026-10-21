import { EMPLOYMENT_TYPES, OWNERSHIP, ROLE_KINDS } from "./labels";

// Small slips in a CV read are fixed, not thrown away (founder round 27: a first upload
// failed twice on "invalid output", and the second try took over a minute). Only the shape
// is fixed: text is cut to its limit, a year alone becomes a month, an unknown label falls
// back to the plainest one. Nothing is added; the person checks every role and item.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const strings = (v: unknown, max: number, len: number): string[] => list(v, max).flatMap((s) => (typeof s === "string" && s.trim() ? [s.trim().slice(0, len)] : []));

/** "2023-03" stays; "2023" becomes January (a start) or December (an end); "03/2023" and "Mar 2023" become "2023-03". */
export function repairMonth(v: unknown, end: boolean): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) return t;
  const iso = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(t);
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return `${iso[1]}-${iso[2]!.padStart(2, "0")}`;
  const slash = /^(\d{1,2})[/.](\d{4})$/.exec(t);
  if (slash && Number(slash[1]) >= 1 && Number(slash[1]) <= 12) return `${slash[2]}-${slash[1]!.padStart(2, "0")}`;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const named = /^([a-z]{3})[a-z]*\.?,?\s+'?(\d{2}|\d{4})$/i.exec(t);
  if (named) {
    const m = months.indexOf(named[1]!.toLowerCase());
    const y = named[2]!.length === 2 ? `20${named[2]}` : named[2];
    if (m >= 0) return `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  if (/^\d{4}$/.test(t)) return `${t}-${end ? "12" : "01"}`;
  return null;
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T | null): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

export function repairCvRead(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const person = isObj(raw.person) ? raw.person : {};
  const sens = isObj(raw.sensitive_found) ? raw.sensitive_found : {};
  return {
    is_cv: raw.is_cv !== false,
    person: {
      full_name: str(person.full_name, 120),
      phone: str(person.phone, 40),
      email: str(person.email, 160),
      city: str(person.city, 80),
      state: str(person.state, 80),
      linkedin_url: str(person.linkedin_url, 200),
      portfolio_url: str(person.portfolio_url, 200),
      website_url: str(person.website_url, 200),
    },
    sensitive_found: {
      date_of_birth: typeof sens.date_of_birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sens.date_of_birth) ? sens.date_of_birth : null,
      gender: str(sens.gender, 30),
      state_of_origin: str(sens.state_of_origin, 60),
      marital_status_present: sens.marital_status_present === true,
      religion_present: sens.religion_present === true,
    },
    roles: list(raw.roles, 30)
      .filter(isObj)
      .map((r) => ({
        kind: oneOf(r.kind, ROLE_KINDS, "job"),
        organisation: str(r.organisation, 160),
        title: str(r.title, 160),
        location: str(r.location, 120),
        start: repairMonth(r.start, false),
        end: r.is_current === true ? null : repairMonth(r.end, true),
        is_current: r.is_current === true,
        grade: str(r.grade, 80),
        employment_type: oneOf(r.employment_type, EMPLOYMENT_TYPES, null),
        items: list(r.items, 20)
          .filter(isObj)
          .flatMap((i) => {
            const text = str(i.text, 400) ?? str(i.source_quote, 400);
            if (!text || text.length < 3) return [];
            return [
              {
                text,
                source_quote: str(i.source_quote, 600) ?? text,
                metrics: list(i.metrics, 6)
                  .filter(isObj)
                  .flatMap((m) => (typeof m.value === "number" && Number.isFinite(m.value) ? [{ value: m.value, unit: str(m.unit, 40) ?? "", approximate: m.approximate === true }] : [])),
                ownership: oneOf(i.ownership, OWNERSHIP, "did"),
                skills: strings(i.skills, 10, 60),
              },
            ];
          }),
      })),
    skills: strings(raw.skills, 60, 60),
    summary: str(raw.summary, 1500),
    referees: list(raw.referees, 4)
      .filter(isObj)
      .flatMap((r) => {
        const name = str(r.name, 120);
        return name ? [{ name, role: str(r.role, 120), organisation: str(r.organisation, 160), phone: str(r.phone, 40), email: str(r.email, 160), relationship: str(r.relationship, 160) }] : [];
      }),
  };
}
