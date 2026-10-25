import type { ParsedJob } from "@/lib/jobs/schema";

// Sample job for the design preview of the core flow (preview mode only, never
// production). The employer is fictional on purpose (D-012).

export type ReqStatus = "met" | "partly" | "missing";
export type RuleResult = "pass" | "fail" | "unknown";

/** Ten days ahead, Lagos time, so the sample job never closes (it was a fixed date, and expired). */
const inTenDays = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(Date.now() + 10 * 86_400_000));

export const DEMO_JOB = {
  id: "demo",
  title: "Graduate Trainee, Finance",
  employer: "Northbridge Bank",
  location: "Victoria Island, Lagos",
  deadline: inTenDays(),
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
  letterFile: "Tolu_Adebayo_Cover_Letter_Graduate_Trainee.pdf",
  // Sample cover letter (preview only, D-186), from the same sample facts as the CV.
  letter: {
    sender: ["Yaba, Lagos", "+234 803 000 0000", "tolu.adebayo@example.com"],
    date: "18 October 2026",
    recipient: ["The Hiring Manager", "Northbridge Bank"],
    heading: "APPLICATION FOR THE POSITION OF GRADUATE TRAINEE (FINANCE)",
    salutation: "Dear Hiring Manager,",
    paragraphs: [
      "I am applying for the Graduate Trainee (Finance) role at Northbridge Bank. I am an Accounting graduate (Second Class Upper) from the University of Lagos with hands-on banking experience from SIWES and a year of finance support at a state ministry during NYSC.",
      "Your programme asks for graduates who are comfortable with reconciliations. At the Ministry of Works, I prepared the finance unit's monthly expense summaries and matched every one to its payment vouchers, so each month closed with figures the unit could rely on.",
      "You also want people who serve customers well. During SIWES at a retail bank branch, I opened about 15 customer accounts a day and checked every customer's documents before an account was opened, which taught me to work quickly without cutting corners. I use Excel daily, including pivot tables, for this kind of work.",
      "I would bring accuracy, steady customer service and a working grasp of banking procedures to your graduate finance team. My CV is enclosed, and I would welcome the chance to discuss how I can contribute at an interview.",
    ],
    closing: "Yours faithfully,",
    name: "Tolu Adebayo",
  },
  checklist: [
    { item: "Your CV as a PDF", done: true },
    { item: "Your cover letter (ready below)", done: true },
    { item: "Use the exact subject line above", done: true },
    { item: "NYSC discharge certificate (they asked for it)", done: false },
  ],
};


/** The sample job as the parser would return it (preview only). */
export const DEMO_PARSED: ParsedJob = {
  is_job_post: true,
  title: DEMO_JOB.title,
  employer_name: DEMO_JOB.employer,
  employer_domain_claimed: "northbridgebank.example",
  employer_is_agency_client: false,
  location: { city: "Victoria Island", state: "Lagos", country: "Nigeria", country_code: "NG", remote: false },
  salary: { min: null, max: null, currency: null, period: null },
  deadline: DEMO_JOB.deadline,
  how_to_apply: {
    channel: "email",
    email: DEMO_JOB.apply.to,
    subject_format: DEMO_JOB.apply.subjectFormat,
    url: null,
    required_documents: ["CV", "NYSC discharge certificate"],
  },
  hard_filters: [
    { type: "min_degree_class", quote: "Minimum of Second Class Upper", number: null, number2: null, values: ["Second Class Upper"], date: null, flag: false },
    { type: "nysc", quote: "Must have completed NYSC by the closing date", number: null, number2: null, values: ["completed"], date: null, flag: true },
    { type: "max_age", quote: "Not more than 26 years as at 31 December 2026", number: 26, number2: null, values: [], date: "2026-12-31", flag: null },
    { type: "location", quote: "Candidates must be willing to work in Lagos", number: null, number2: null, values: ["Lagos"], date: null, flag: true },
  ],
  requirements: [
    { text: "Degree in Accounting, Finance or Economics", importance: "must" },
    { text: "Strong Excel skills", importance: "must" },
    { text: "Experience with financial reporting", importance: "must" },
    { text: "Customer service experience", importance: "must" },
    { text: "ICAN or ACCA", importance: "nice" },
  ],
  contacts: { emails: [DEMO_JOB.apply.to], phones: [] },
  payment_mentioned: { mentioned: false, quote: null },
  visa_sponsorship: "not_mentioned",
  experience_level: "graduate_programme",
};
