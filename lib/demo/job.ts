// Sample job for the design preview of the core flow (preview mode only, never
// production). The employer is fictional on purpose (D-012).

export type ReqStatus = "met" | "partly" | "missing";
export type RuleResult = "pass" | "fail" | "unknown";

export const DEMO_JOB = {
  id: "demo",
  title: "Graduate Trainee, Finance",
  employer: "Northbridge Bank",
  location: "Victoria Island, Lagos",
  deadline: "2026-10-24",
  apply: { channel: "email" as const, to: "graduatetrainee@northbridgebank.example", subjectFormat: "GTP2026: [Full Name], [Course]" },
  destination: { country: "Nigeria", format: "Nigerian graduate programme" },
  capturedVia: "Pasted text",
};

export const DEMO_ELIGIBILITY: { rule: string; result: RuleResult; quote: string; yours: string }[] = [
  { rule: "Class of degree", result: "pass", quote: "Minimum of Second Class Upper", yours: "Second Class Upper, BSc Accounting" },
  { rule: "NYSC", result: "pass", quote: "Must have completed NYSC by the closing date", yours: "Completed, Oct 2026" },
  { rule: "Age", result: "pass", quote: "Not more than 26 years as at 31 December 2026", yours: "Within the limit" },
  { rule: "Location", result: "pass", quote: "Candidates must be willing to work in Lagos", yours: "Lives in Lagos" },
];

export const DEMO_SCAM = {
  state: "verified" as "verified" | "unverified" | "red_flags",
  headline: "Found on the official careers page at northbridgebank.example. Even so, never pay to apply.",
  signals: [
    { ok: true, text: "The job appears on the employer's official careers page", source: "northbridgebank.example/careers" },
    { ok: true, text: "The contact email matches the employer's own website", source: null },
    { ok: true, text: "The post does not ask for any payment", source: null },
  ],
};

export const DEMO_VERDICT = {
  verdict: "apply" as "apply" | "apply_with_care" | "skip",
  line: "You meet every hard requirement and your strongest match is your SIWES audit work. Let's build this one.",
  requirements: [
    { text: "Degree in Accounting, Finance or Economics", status: "met" as ReqStatus, from: "BSc Accounting, University of Lagos" },
    { text: "Strong Excel skills", status: "met" as ReqStatus, from: "Built an Excel stock tracking tool with macros" },
    { text: "Experience with financial reporting", status: "partly" as ReqStatus, from: "Prepared monthly expense summaries during NYSC" },
    { text: "Customer service experience", status: "met" as ReqStatus, from: "Opened about 15 customer accounts a day during SIWES" },
    { text: "ICAN or ACCA (nice to have)", status: "missing" as ReqStatus, from: null },
  ],
  gaps: [{ gap: "Financial reporting is only partly covered", fix: "Mention your NYSC expense summaries in the email, and be ready to walk through one in the interview." }],
};

export type CvBullet = { id: string; text: string; change: "kept" | "reworded" | "reordered"; source: string; flag?: { type: "number" | "ownership"; message: string } };

export const DEMO_CV = {
  name: "Tolu Adebayo",
  contact: "+234 803 000 0000 · tolu.adebayo@gmail.com · Yaba, Lagos",
  title: "Accounting graduate, ICAN Skills level",
  summary:
    "Accounting graduate (Second Class Upper) with retail banking experience from SIWES, opening about 15 customer accounts a day, and a year of NYSC finance support at a state ministry.",
  sections: [
    { heading: "Education", lines: ["BSc Accounting, University of Lagos · Second Class Upper · 2019 to 2024"] },
    { heading: "NYSC", lines: ["Completed, Oct 2026 · Finance Unit, Ministry of Works, Ogun State"] },
  ],
  roles: [
    {
      title: "Finance Assistant (NYSC)",
      org: "Ministry of Works, Ogun State",
      dates: "Nov 2025 to Oct 2026",
      bullets: [
        { id: "b1", text: "Prepared monthly expense summaries for the finance unit and reconciled them with payment vouchers.", change: "reworded", source: "\"I did the monthly expense summary and matched it with the vouchers\"" },
        { id: "b2", text: "Led the move of 3 years of paper records into a shared spreadsheet.", change: "reworded", source: "\"I helped move old records into Excel with two other corps members\"", flag: { type: "ownership", message: "This line says you led this. Your notes say you helped." } },
      ] as CvBullet[],
    },
    {
      title: "SIWES Intern, Retail Banking",
      org: "Northline Bank, Yaba Branch",
      dates: "Jan 2023 to Jun 2023",
      bullets: [
        { id: "b3", text: "Opened about 15 customer accounts a day and checked each customer's documents.", change: "reworded", source: "\"I did account opening, around 15 a day, and I checked their documents\"" },
        { id: "b4", text: "Reduced queue time at the account opening desk by 20%.", change: "reworded", source: "\"The queue moved faster after we split the forms\"", flag: { type: "number", message: "This line has a number you did not give us. Add the real figure or remove it before you download." } },
      ] as CvBullet[],
    },
  ],
  skills: "Tools: Excel (macros, pivot tables), Sage 50 · Professional: reconciliation, customer onboarding · Languages: English, Yoruba",
};

export const DEMO_PACK = {
  to: DEMO_JOB.apply.to,
  subject: "GTP2026: Tolu Adebayo, Accounting",
  body: `Dear Hiring Team,

I am applying for the Graduate Trainee (Finance) role. I hold a BSc in Accounting (Second Class Upper) from the University of Lagos and completed NYSC in October 2026.

During SIWES at a retail bank branch, I opened about 15 customer accounts a day. At the Ministry of Works, I prepared monthly expense summaries and reconciled them with payment vouchers.

My CV is attached. Thank you for considering my application.

Yours faithfully,
Tolu Adebayo
+234 803 000 0000`,
  attachment: "Tolu_Adebayo_CV_Graduate_Trainee.pdf",
  checklist: [
    { item: "Your CV as a PDF", done: true },
    { item: "Use the exact subject line above", done: true },
    { item: "NYSC discharge certificate (they asked for it)", done: false },
  ],
};
