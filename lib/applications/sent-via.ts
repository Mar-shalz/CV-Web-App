// How the person sent an application themselves (founder round 32, D-199). Not every job
// wants the email we prepare: some take the CV on WhatsApp, a job site like Indeed or
// Jobberman, the company's own website, or by hand.

export const SENT_VIA = ["whatsapp", "job_site", "website", "email", "in_person", "other"] as const;
export type SentVia = (typeof SENT_VIA)[number];

export const SENT_VIA_LABELS: Record<SentVia, { label: string; hint: string | null }> = {
  whatsapp: { label: "WhatsApp", hint: null },
  job_site: { label: "A job site", hint: "Indeed, Jobberman, LinkedIn and others" },
  website: { label: "The company's website or form", hint: null },
  email: { label: "Email, from my own inbox", hint: null },
  in_person: { label: "By hand", hint: "Dropped off or handed over" },
  other: { label: "Another way", hint: null },
};

/** A short tag for the board's cards. */
export const SENT_VIA_SHORT: Record<SentVia, string> = { whatsapp: "WhatsApp", job_site: "Job site", website: "Website", email: "Email", in_person: "By hand", other: "Other" };

/** "Sent on WhatsApp", for the application's record. */
export const SENT_VIA_PHRASE: Record<SentVia, string> = {
  whatsapp: "on WhatsApp",
  job_site: "on a job site",
  website: "on the company's website",
  email: "by email",
  in_person: "by hand",
  other: "another way",
};

export const isSentVia = (v: unknown): v is SentVia => typeof v === "string" && (SENT_VIA as readonly string[]).includes(v);
