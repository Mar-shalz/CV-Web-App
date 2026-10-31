// What each field on an employer's application form asks for (founder round 35, D-206), so
// the extension can fill it from the person's own details. Pure, so it is unit tested.
// Never filled: date of birth, gender, state of origin and other personal or protected
// details, salary, and passwords (the founder: "don't touch this"). The person fills those.

export type FieldKind =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "city"
  | "region"
  | "linkedin"
  | "website"
  | "current_title"
  | "current_employer"
  | "school"
  | "qualification"
  | "cover_letter"
  | "cv_file"
  | "question"
  | "personal"
  | "unknown";

export type FormField = { key: string; label: string; type: string; autocomplete?: string | null; name?: string | null; placeholder?: string | null };

const PERSONAL =
  /\b(date of birth|birth ?date|dob|birthday|age|gender|sex|pronouns?|state of origin|lga|local government|marital|married|race|tribe|veteran|passport|bvn|nin|national id|social security|ssn|salary|compensation|expected pay|current pay|remuneration|password|passcode|pin)\b|\b(religio|disab|ethnic|nationalit|citizen|criminal|convict)/i;
const QUESTION = /\?\s*$|^(why|what|how|describe|tell us|explain|share|give an example|in your own words|briefly|please describe|please explain)\b/i;

/** The words a field is known by: its label, then its placeholder, name and autocomplete hint. */
const words = (f: FormField) => [f.label, f.placeholder, f.name, f.autocomplete].filter(Boolean).join(" ").replace(/[_-]+/g, " ").toLowerCase();

export function classify(f: FormField): FieldKind {
  const t = words(f);
  const ac = (f.autocomplete ?? "").toLowerCase();
  if (PERSONAL.test(t)) return "personal";
  if (f.type === "file") return /\b(cover|letter|photo|picture|transcript|certificate|id card)\b/.test(t) ? "unknown" : "cv_file";
  if (/\b(street|address line|home address|postal|zip|post code|postcode)\b/.test(t)) return "unknown";
  if (ac === "given-name" || /\b(first|given) ?name\b|\bforename\b/.test(t)) return "first_name";
  if (ac === "family-name" || /\b(last|family|sur) ?name\b|\bsurname\b/.test(t)) return "last_name";
  if (f.type === "email" || ac === "email" || /\be-?mail\b/.test(t)) return "email";
  if (f.type === "tel" || ac.startsWith("tel") || /\b(phone|mobile|telephone|whatsapp number|cell)\b/.test(t)) return "phone";
  if (/\blinked ?in\b/.test(t)) return "linkedin";
  if (f.type === "url" || ac === "url" || /\b(website|portfolio|personal site|github)\b/.test(t)) return "website";
  if (/\bcover ?letter\b|\bmessage to (the )?(hiring|recruit)/.test(t)) return "cover_letter";
  // A written question: phrased as one, or a long prompt over a big text box.
  if (QUESTION.test(f.label.trim()) || (f.type === "textarea" && f.label.trim().length >= 25)) return "question";
  if (ac === "name" || /^(full )?name\b|\bfull name\b|\byour name\b/.test(t)) return "full_name";
  if (ac === "address-level2" || /\b(city|town)\b/.test(t)) return "city";
  if (ac === "address-level1" || /\b(state|region|province)\b/.test(t)) return "region";
  if (/\b(current|most recent|present) (job )?(title|position|role)\b|\bjob title\b/.test(t)) return "current_title";
  if (/\b(current|most recent|present) (employer|company|organi[sz]ation)\b/.test(t)) return "current_employer";
  if (/\b(school|university|college|institution|polytechnic)\b/.test(t)) return "school";
  if (/\b(degree|qualification|course of study|field of study|discipline)\b/.test(t)) return "qualification";
  return "unknown";
}

/** First and last name from a full name: the last word is the surname. */
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1)! };
}
