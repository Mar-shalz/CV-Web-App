import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/brand/logo";
import { LandingMenu } from "@/components/brand/landing-menu";
import { RecordSample } from "@/components/landing/sample";
import { Add, ArrowRight, ClipboardText, DocumentText, DocumentText1, Gallery, Link21, Microphone, MinusCircle, ShieldSearch, TickCircle, Warning2 } from "@/components/icons";
import { APP, APP_NAME } from "@/lib/config";

// The landing page (founder round 50, from the founder's landing page blueprint). Two
// foundations lead: check a job, and keep a record of what you sent. Every example is drawn
// in HTML from one fictional role and labelled as an example: no screenshots, no prices while
// charging is off (D-196). Material rule, after Apple's: blur only on the bar that floats
// over the page; everything you read sits on a solid surface.

const SITE = (APP as { app_url?: string }).app_url ?? "https://applywithproof.vercel.app";
const DESCRIPTION = `Check job ads for warning signs and track applications with the job description and CV you used. Add applications made anywhere with ${APP_NAME}.`;

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} | Job Ad Checks and Application Tracking` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: `${APP_NAME} | Job Ad Checks and Application Tracking`, description: DESCRIPTION, url: SITE },
};

const NAV: [string, string][] = [
  ["Job checks", "#job-checks"],
  ["Application records", "#records"],
  ["How it works", "#how"],
  ["FAQs", "#faqs"],
];

const BTN = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]";
const PRIMARY = `${BTN} min-h-14 bg-brand-600 px-7 text-[1.0625rem] text-white hover:bg-brand-700`;
const SECONDARY = `${BTN} min-h-14 border border-ink-200 bg-white px-7 text-[1.0625rem] text-ink-900 hover:border-ink-300 hover:bg-ink-50`;
const SMALL = `${BTN} min-h-12 px-6 text-[0.9375rem]`;
const H2 = "font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink-900 sm:text-[2.5rem] lg:text-[3rem]";
const LEAD = "text-[1.0625rem] leading-7 text-ink-600 lg:text-[1.1875rem] lg:leading-8";
const EYEBROW = "text-[0.9375rem] font-semibold text-brand-700";
const CARD = "rounded-[28px] bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_40px_80px_-40px_rgb(15_23_42/0.28)]";
const WRAP = "mx-auto max-w-[1080px] px-5 lg:px-8";

// One fictional job check, in the app's own words for each finding.
type Finding = { label: string; status: "pass" | "warn" | "unknown"; detail: string };
const FINDINGS: Finding[] = [
  { label: "The company exists", status: "pass", detail: "Found in the company register and on its own website." },
  { label: "Email and apply link are on the company's own website", status: "warn", detail: "The ad gives a Gmail address. The company's website lists a different one, so confirm the address on the official site before you send anything." },
  { label: "Listed under the company's name", status: "pass", detail: "The same role is on the company's careers page." },
  { label: "Where the job was posted", status: "unknown", detail: "The ad was pasted as text, so there was no page to look at." },
  { label: "How long it has been around", status: "pass", detail: "Registered in 2004." },
  { label: "No public warnings about this job", status: "pass", detail: "No warning turned up in the searches run on 2 November 2026." },
];
const WORD = {
  pass: { word: "Yes", icon: TickCircle, cls: "text-proof-700" },
  warn: { word: "Check this", icon: Warning2, cls: "text-care-700" },
  unknown: { word: "Couldn't check", icon: MinusCircle, cls: "text-ink-500" },
} as const;

const INPUTS = [
  { icon: Link21, label: "Job link" },
  { icon: ClipboardText, label: "Pasted description" },
  { icon: DocumentText, label: "PDF" },
  { icon: DocumentText1, label: "Word document" },
  { icon: Gallery, label: "Screenshot" },
];

// What the ad asks for, beside what the person's own experience says.
const FIT = [
  { kind: "Minimum", ask: "NYSC discharge or exemption certificate", yours: "NYSC completed in 2025", status: "Met", tone: "bg-proof-50 text-proof-700" },
  { kind: "Minimum", ask: "Second Class Upper or above", yours: "BSc Accounting, Second Class Upper", status: "Met", tone: "bg-proof-50 text-proof-700" },
  { kind: "Preferred", ask: "Advanced Excel", yours: "Excel for daily attendance records", status: "Partly met", tone: "bg-care-50 text-care-700" },
  { kind: "Preferred", ask: "ICAN student membership", yours: "Not in your experience", status: "Missing", tone: "bg-ink-100 text-ink-700" },
  { kind: "Not stated", ask: "Where the role is based", yours: "The ad does not say", status: "Unknown", tone: "bg-ink-100 text-ink-700" },
];

const MATCHES = [
  { title: "Graduate Trainee, Finance", where: "Northbridge Bank, Lagos", percent: 88 },
  { title: "Accounts Assistant", where: "Harbour Foods, Abuja", percent: 79 },
  { title: "Operations Analyst", where: "Fieldline, remote", percent: 68 },
];

const FAQ = [
  {
    q: `What can I use ${APP_NAME} for?`,
    a: "Check a job advertisement for warning signs and keep a record of your applications, including the job details, CV used and progress. You can also review your fit, prepare a CV and practise for an interview.",
  },
  {
    q: `Can I add jobs I applied for outside ${APP_NAME}?`,
    a: `Yes. Add the company, role, job description and CV you used, then keep track of the application's progress. The application does not have to start in ${APP_NAME}.`,
  },
  { q: "Do I have to use the CV builder to track an application?", a: "No. You can record an application made with a CV you prepared elsewhere." },
  {
    q: "Do I need an account to check a job?",
    a: "A quick check of an ad's wording needs no account. The full check looks up the company, its contact details and where the job was posted. It is free with an account, and the account also keeps your application records and your saved experience.",
  },
  {
    q: "Can a check guarantee the job is genuine?",
    a: "No. It shows available evidence, warning signs and details it could not confirm. Review those findings and the employer's official recruitment channels before sharing documents or making a payment.",
  },
  {
    q: "What does the match percentage mean?",
    a: "It compares the supplied job requirements with your profile. It can highlight gaps and missing information. It does not predict an interview, offer or employer decision.",
  },
  {
    q: `How does ${APP_NAME} use my experience in a CV?`,
    a: "It drafts from experience you have confirmed and flags details that need attention. Review the suggestions and decide what to accept, edit or keep. Your confirmation is not independent verification by an employer or university.",
  },
  {
    q: `Does ${APP_NAME} submit applications for me?`,
    a: `No. You review and submit your applications. When you mark one as sent, ${APP_NAME} keeps its record. It does not verify that the employer received or read it.`,
  },
  {
    q: "Can I use it on my phone or without a connection?",
    a: "Use the web app on your phone. Application records you have opened on that phone stay readable offline, with the saved job and CV. A new job check or AI draft needs a connection. The Chrome extension is for desktop use.",
  },
  {
    q: "What happens to my information?",
    a: "See the privacy notice for how imports, confirmed experience and application records are handled, the providers involved and your export and deletion options. Review the details included in an application before sending it.",
  },
];

function Finding({ f }: { f: Finding }) {
  const w = WORD[f.status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold ${w.cls}`}>
      <w.icon size={16} variant="bulk" />
      {w.word}
    </span>
  );
}

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-[1.0625rem] leading-7 text-ink-800">
          <TickCircle size={22} variant="bulk" className="mt-0.5 shrink-0 text-brand-600" />
          {t}
        </li>
      ))}
    </ul>
  );
}

const Example = ({ children = "Illustrative example" }: { children?: string }) => <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">{children}</span>;

export default async function LandingPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}/#org`, name: APP_NAME, url: SITE, logo: `${SITE}/icon.svg`, email: APP.support_email },
      { "@type": "WebSite", "@id": `${SITE}/#site`, name: APP_NAME, url: SITE, publisher: { "@id": `${SITE}/#org` }, inLanguage: "en-NG" },
      {
        "@type": "WebApplication",
        name: APP_NAME,
        url: SITE,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any (web), Chrome extension",
        description: DESCRIPTION,
        featureList: ["Job ad checks for warning signs", "Application records with the job and the CV sent", "Fit guidance against stated requirements", "CVs prepared from confirmed experience", "Interview practice from a saved application", "Chrome extension for desktop"],
      },
      { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <div className="min-h-dvh bg-white text-ink-900">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ------------------------------------------------------------- Bar */}
      <header className="lp-bar sticky top-0 z-40">
        <nav aria-label="Main" className={`${WRAP} relative flex h-16 items-center justify-between gap-3`}>
          <Link href="/" aria-label={`${APP_NAME} home`} className="rounded-xl">
            <Logo size={30} />
          </Link>
          <ul className="hidden items-center gap-1 text-[0.9375rem] font-medium text-ink-700 lg:flex">
            {NAV.map(([label, href]) => (
              <li key={href}>
                <a href={href} className="inline-flex min-h-11 items-center rounded-full px-3.5 transition-colors duration-150 hover:text-ink-950">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            <Link href="/sign-in" className="hidden min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium text-ink-700 transition-colors duration-150 hover:text-ink-950 sm:inline-flex">
              Sign in
            </Link>
            <Link href="/sign-in" className={`${SMALL} bg-brand-600 text-white hover:bg-brand-700`}>
              Get started
            </Link>
            <LandingMenu links={[...NAV, ["Sign in", "/sign-in"]]} />
          </div>
        </nav>
      </header>

      <main id="main">
        {/* ------------------------------------------------------------ Hero */}
        <section aria-labelledby="hero-title" className={`${WRAP} pb-16 pt-14 text-center sm:pt-20 lg:pb-24`}>
          <div>
            <p className={EYEBROW}>Your job application companion</p>
            <h1 id="hero-title" className="mt-4 text-balance font-display text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-ink-950 sm:text-[3.25rem] lg:text-[4rem]">
              <span className="block">Check the job.</span> <span className="block">Keep track of what you sent.</span>
            </h1>
            <p className={`mx-auto mt-5 max-w-[40rem] ${LEAD}`}>Check job ads for warning signs and keep the job description, CV and progress for each application together. Add applications made anywhere.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/check" className={PRIMARY}>
                Check a job
              </Link>
              <Link href="/applications/new" prefetch={false} className={SECONDARY}>
                Track my applications
              </Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-500">No account needed for a quick check. Sign in to keep your applications.</p>
          </div>

          {/* The two foundations, side by side: the same fictional role in each. */}
          <div className="lp-enter lp-stage mt-12 rounded-[36px] p-4 text-left sm:p-8 lg:mt-16 lg:p-12" style={{ animationDelay: "120ms" }}>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <article aria-label="Example job check" className="rounded-[24px] bg-white p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-brand-700">
                  <ShieldSearch size={18} variant="bulk" />
                  Job check
                </p>
                <p className="mt-2 font-display text-lg font-semibold leading-6 tracking-[-0.01em]">Graduate Trainee, Finance</p>
                <p className="text-sm leading-5 text-ink-600">Northbridge Bank</p>
                <p className="mt-4 flex items-start gap-2 rounded-2xl bg-care-50 p-3 text-sm font-medium leading-5 text-care-800">
                  <Warning2 size={18} variant="bulk" className="mt-px shrink-0 text-care-600" />
                  Look at the one marked Check this before you send your details.
                </p>
                <ul className="mt-3 divide-y divide-ink-100">
                  {FINDINGS.slice(0, 4).map((f) => (
                    <li key={f.label} className="flex items-center justify-between gap-4 py-3 text-[0.9375rem] leading-5 text-ink-800">
                      {f.label}
                      <Finding f={f} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.8125rem] text-ink-500">Checked on 2 November 2026</p>
              </article>

              <article aria-label="Example application record" className="rounded-[24px] bg-white p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-brand-700">
                  <DocumentText size={18} variant="bulk" />
                  Application record
                </p>
                <dl className="mt-3 divide-y divide-ink-100 text-[0.9375rem] leading-5">
                  {[
                    ["Company", "Northbridge Bank"],
                    ["Role", "Graduate Trainee, Finance"],
                    ["Job description", "Saved copy"],
                    ["CV used", "Tolu_Adebayo_CV.pdf"],
                    ["How I applied", "Email"],
                    ["Status", "Sent"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-ink-500">{k}</dt>
                      <dd className="text-right font-medium text-ink-900">
                        {k === "Status" ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.8125rem] font-semibold text-brand-800">{v}</span> : v}
                        {k === "CV used" ? <span className="mt-1 block text-xs font-semibold text-brand-700">CV prepared elsewhere</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>
            <p className="mt-5 text-center text-[0.8125rem] leading-5 text-white/75">Illustrative example. Northbridge Bank is fictional, and no live job check has been run.</p>
          </div>

          <p className="mt-8 text-[0.9375rem] font-medium text-ink-600">Built around the realities of applying in Nigeria.</p>
        </section>

        {/* ----------------------------------------------------- Input strip */}
        <section aria-labelledby="bring-title" className="border-y border-ink-100 bg-ink-50">
          <div className={`${WRAP} py-12 text-center lg:py-14`}>
            <h2 id="bring-title" className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] sm:text-[1.625rem]">
              Bring the opportunity you found.
            </h2>
            <p className="mt-2 text-[1.0625rem] leading-7 text-ink-600">Start with a job link, pasted description, PDF, Word document or screenshot.</p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
              {INPUTS.map((i) => (
                <li key={i.label} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[0.9375rem] font-medium text-ink-800 shadow-[0_0_0_1px_rgb(15_23_42/0.07)]">
                  <i.icon size={18} className="text-brand-600" />
                  {i.label}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[0.9375rem] leading-6 text-ink-600">
              Already applied?{" "}
              <Link href="/applications/new" prefetch={false} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
                Add the application to your records.
              </Link>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ Job checks */}
        <section id="job-checks" aria-labelledby="checks-title" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className={EYEBROW}>Before you apply</p>
              <h2 id="checks-title" className={`mt-3 ${H2}`}>
                Look into the job before you take the next step.
              </h2>
              <p className={`mt-5 ${LEAD}`}>
                A familiar company name does not tell you who posted the ad. {APP_NAME} checks the company, contact details and application source, then shows the warning signs, supporting evidence and details it could not confirm.
              </p>
              <Ticks items={["Review the recruiter contact and application link.", "See requests for payment and other warning signs.", "Share the findings with someone else considering the job."]} />
              <Link href="/check" className={`${SMALL} mt-8 bg-brand-600 text-white hover:bg-brand-700`}>
                Check a job
              </Link>
              <p className="mt-4 text-sm leading-6 text-ink-500">Findings to help you investigate. No guarantee that a job is genuine.</p>
            </div>

            <div className={`${CARD} p-5 sm:p-7`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Example />
                <p className="text-[0.8125rem] text-ink-500">Checked on 2 November 2026</p>
              </div>
              <p className="mt-4 font-display text-[1.375rem] font-semibold leading-7 tracking-[-0.02em]">Graduate Trainee, Finance</p>
              <p className="text-[0.9375rem] leading-6 text-ink-600">Northbridge Bank</p>
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-care-50 p-3.5 text-[0.9375rem] font-medium leading-6 text-care-800">
                <Warning2 size={20} variant="bulk" className="mt-0.5 shrink-0 text-care-600" />
                Look at the one marked Check this before you send your details, and never pay to apply.
              </p>
              <div className="mt-3 divide-y divide-ink-100">
                {FINDINGS.map((f) => (
                  <details key={f.label} className="lp-row group" open={f.status === "warn"}>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-medium leading-5 text-ink-900">
                      {f.label}
                      <span className="flex shrink-0 items-center gap-2">
                        <Finding f={f} />
                        <Add size={16} className="lp-plus text-ink-400 transition-transform duration-200" />
                      </span>
                    </summary>
                    <p className="lp-swap pb-4 pr-8 text-[0.9375rem] leading-6 text-ink-600">{f.detail}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------- Application records */}
        <section id="records" aria-labelledby="records-title" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
          <div className={`${WRAP} grid items-start gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div className="lg:order-2">
              <p className={EYEBROW}>After you apply</p>
              <h2 id="records-title" className={`mt-3 ${H2}`}>
                Keep the job description and the CV you sent together.
              </h2>
              <p className={`mt-5 ${LEAD}`}>
                Remember the company, the role and the CV you used for each application. Keep a copy of the job details, record how you applied and follow its progress, even when the original post disappears.
              </p>
              <Ticks
                items={[
                  "Save the job snapshot and CV version for that application.",
                  "Record the submission method and update the status.",
                  `Bring applications made elsewhere, including those using a CV prepared outside ${APP_NAME}.`,
                  "Return to the record when a test or interview invitation arrives.",
                ]}
              />
              <Link href="/applications/new" prefetch={false} className={`${SMALL} mt-8 bg-brand-600 text-white hover:bg-brand-700`}>
                Add an application
              </Link>
              <p className="mt-4 text-sm leading-6 text-ink-500">
                You do not have to use {APP_NAME}&apos;s CV builder to keep an application record. Marking an application as sent records your confirmation. It does not verify delivery or prove that an employer read it.
              </p>
            </div>
            <div className="lg:order-1">
              <RecordSample />
              <p className="mt-4 text-center text-[0.8125rem] leading-5 text-ink-500">Try it: open the CV used, then move the example to Interview.</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- Short walkthrough */}
        <section id="how" aria-labelledby="how-title" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
          <h2 id="how-title" className={`max-w-[20ch] ${H2}`}>
            Start with the job in front of you.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              { q: "Considering a job?", a: "Bring the ad, review the findings and decide what needs a closer look.", href: "/check", cta: "Check a job", open: true },
              { q: "Already applied?", a: "Add the company, job description and CV you used, then keep track of the next step.", href: "/applications/new", cta: "Add an application", open: false },
              { q: "Need help preparing?", a: "Review your fit, tailor a CV from your experience and save the application after you send it.", href: "/sign-in", cta: "Get started", open: true },
            ].map((p) => (
              <div key={p.q} className="border-t border-ink-200 pt-6">
                <h3 className="font-display text-[1.375rem] font-semibold tracking-[-0.02em]">{p.q}</h3>
                <p className="mt-2 text-[1.0625rem] leading-7 text-ink-600">{p.a}</p>
                <Link href={p.href} prefetch={p.open ? undefined : false} className="group mt-4 inline-flex min-h-11 items-center gap-1.5 text-[1.0625rem] font-semibold text-brand-700 underline-offset-4 hover:underline">
                  {p.cta}
                  <ArrowRight size={18} className="nudge" />
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-10 text-[1.0625rem] leading-7 text-ink-600">
            Want to look first?{" "}
            <a href="#records" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
              See a sample
            </a>
          </p>
        </section>

        {/* ----------------------------------------------- Fit and CV preparation */}
        <section id="prepare" aria-label="Fit and CV preparation" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
          <div className={`${WRAP} grid gap-5 lg:grid-cols-2`}>
            <article aria-labelledby="fit-title" className="rounded-[32px] bg-white p-6 shadow-[0_0_0_1px_rgb(15_23_42/0.05)] sm:p-9">
              <h2 id="fit-title" className="font-display text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[2rem]">
                See what the role asks for and where you stand.
              </h2>
              <p className="mt-4 text-[1.0625rem] leading-7 text-ink-600">
                Compare the post with your experience and stated requirements, including NYSC status, degree class, licences and location where relevant. Review what is met, partly met or missing before deciding whether to apply.
              </p>
              <ul className="mt-6 divide-y divide-ink-100 border-y border-ink-100">
                {FIT.map((r) => (
                  <li key={r.ask} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-3.5">
                    <p className="text-[0.9375rem] font-medium leading-5 text-ink-900">
                      <span className="mr-2 text-[0.8125rem] font-semibold text-ink-500">{r.kind}</span>
                      {r.ask}
                    </p>
                    <span className={`row-span-2 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${r.tone}`}>{r.status}</span>
                    <p className="text-sm leading-5 text-ink-600">Yours: {r.yours}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-6 text-ink-500">Illustrative example. A match score explains alignment with the role. It does not predict a hiring decision.</p>
            </article>

            <article aria-labelledby="cv-title" className="rounded-[32px] bg-white p-6 shadow-[0_0_0_1px_rgb(15_23_42/0.05)] sm:p-9">
              <h2 id="cv-title" className="font-display text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[2rem]">
                Prepare a relevant CV from experience you can explain.
              </h2>
              <p className="mt-4 text-[1.0625rem] leading-7 text-ink-600">
                Add work you have actually done, including internships, NYSC, SIWES, projects and volunteering. Review your experience, then use it to prepare a CV for the role. Accept the suggested wording, edit it or keep your own.
              </p>
              <details className="lp-row group mt-6 rounded-2xl border border-paper-edge bg-paper">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                  <span>
                    <span className="block text-[0.8125rem] font-semibold text-ink-500">Suggested sentence</span>
                    <span className="mt-1 block text-[1.0625rem] leading-7 text-ink-900">Updated daily attendance records in Excel and flagged missing entries for weekly reporting.</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-proof-700">
                      <TickCircle size={16} variant="bulk" />
                      Confirmed by you
                    </span>
                  </span>
                  <Add size={18} className="lp-plus mt-1 shrink-0 text-ink-400 transition-transform duration-200" />
                </summary>
                <p className="lp-swap border-t border-paper-edge p-4 text-[0.9375rem] leading-6 text-ink-700">
                  <span className="block text-[0.8125rem] font-semibold text-ink-500">From your experience</span>
                  Updated daily attendance records in Excel, flagged missing entries and prepared information for weekly reporting during NYSC.
                </p>
              </details>
              <Ticks items={["Confirm the experience that goes into your profile.", "Review proposed changes and any details flagged for attention.", "Choose a clear layout and download a PDF or Word document."]} />
              <Link href="/sign-in" className={`${SMALL} mt-8 border border-ink-200 bg-white text-ink-900 hover:bg-ink-50`}>
                Prepare my CV
              </Link>
              <p className="mt-4 text-sm leading-6 text-ink-500">Illustrative example. You review the details and decide what to use.</p>
            </article>
          </div>
        </section>

        {/* ------------------------------------------------- Interview practice */}
        <section id="interview" aria-labelledby="interview-title" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 id="interview-title" className={H2}>
                When the invite comes, return to what you sent.
              </h2>
              <p className={`mt-5 ${LEAD}`}>Open the application record and practise with questions based on the role and your CV. Answer by voice, work through follow-up questions and review the feedback at the end.</p>
              <a href="#interview-example" className={`${SMALL} mt-8 border border-ink-200 bg-white text-ink-900 hover:bg-ink-50`}>
                See an interview example
              </a>
            </div>
            <div className="lp-stage rounded-[32px] p-6 text-white sm:p-9">
              <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-sky-300">
                <Microphone size={18} variant="bulk" />
                Practice question 2 of 7
              </p>
              <p className="mt-3 font-display text-[1.375rem] font-semibold leading-8 tracking-[-0.02em]">You said the weekly report was late twice. What did you change after the second time?</p>
              <p className="mt-4 text-[0.9375rem] leading-6 text-white/75">A follow-up built on the answer before it. Seven questions, then feedback on all of them.</p>
              <p className="mt-6 text-[0.8125rem] text-white/60">Illustrative example</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Jobs for You */}
        <section id="jobs-for-you" aria-labelledby="jobs-title" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
          <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
            <div className="lg:order-2">
              <h2 id="jobs-title" className={H2}>
                Find more opportunities to consider.
              </h2>
              <p className={`mt-5 ${LEAD}`}>Explore jobs selected from connected feeds against your experience and the roles you are pursuing. Review the job and its fit before choosing your next step.</p>
              <Link href="/matches" prefetch={false} className={`${SMALL} mt-8 border border-ink-200 bg-white text-ink-900 hover:bg-ink-100`}>
                Explore Jobs for You
              </Link>
            </div>
            <div className={`${CARD} p-5 sm:p-7 lg:order-1`}>
              <Example>Illustrative example. Fictional employers.</Example>
              <ul className="mt-3 divide-y divide-ink-100">
                {MATCHES.map((m) => (
                  <li key={m.title} className="flex items-center justify-between gap-4 py-4">
                    <span>
                      <span className="block text-[1.0625rem] font-semibold leading-6 text-ink-900">{m.title}</span>
                      <span className="block text-sm leading-5 text-ink-600">{m.where}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold ${m.percent >= 85 ? "bg-proof-50 text-proof-700" : "bg-ink-100 text-ink-700"}`}>{m.percent}% match</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- Desktop extension */}
        <section id="extension" aria-labelledby="ext-title" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className={EYEBROW}>On desktop</p>
              <h2 id="ext-title" className={`mt-3 ${H2}`}>
                Keep {APP_NAME} beside the job you are reading.
              </h2>
              <p className={`mt-5 ${LEAD}`}>Use the desktop panel to check a job, review your fit and prepare your application while you browse. Review the form answers and email draft before you submit anything yourself.</p>
              <Link href="/extension" prefetch={false} className={`${SMALL} mt-8 border border-ink-200 bg-white text-ink-900 hover:bg-ink-50`}>
                About the Chrome extension
              </Link>
              <p className="mt-4 text-sm leading-6 text-ink-500">Available for desktop testing. Manual setup is required.</p>
            </div>
            {/* A browser window drawn in HTML: a job page with the side panel beside it. */}
            <div className={`${CARD} min-w-0 overflow-hidden`} aria-hidden="true">
              <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-3">
                <span className="size-3 rounded-full bg-ink-200" />
                <span className="size-3 rounded-full bg-ink-200" />
                <span className="size-3 rounded-full bg-ink-200" />
                <span className="ml-3 min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1.5 text-xs text-ink-500">northbridgebank.example/careers/graduate-trainee-finance</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_180px] sm:grid-cols-[minmax(0,1fr)_230px]">
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 rounded bg-ink-150" />
                  <div className="h-3 w-1/3 rounded bg-ink-100" />
                  <div className="mt-5 space-y-2">
                    {[92, 84, 88, 70, 80, 60, 76].map((w, i) => (
                      <div key={i} className="h-2.5 rounded bg-ink-100" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
                <div className="border-l border-ink-100 bg-ink-50 p-3.5">
                  <p className="text-[0.6875rem] font-semibold text-brand-700">{APP_NAME}</p>
                  <p className="mt-1 text-sm font-semibold leading-5">Graduate Trainee, Finance</p>
                  <div className="mt-3 rounded-xl bg-white p-2.5 shadow-[0_0_0_1px_rgb(15_23_42/0.06)]">
                    <p className="text-[0.6875rem] font-semibold text-ink-500">Job check</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-care-700">
                      <Warning2 size={14} variant="bulk" />1 to check
                    </p>
                  </div>
                  <div className="mt-2 rounded-xl bg-white p-2.5 shadow-[0_0_0_1px_rgb(15_23_42/0.06)]">
                    <p className="text-[0.6875rem] font-semibold text-ink-500">Your fit</p>
                    <p className="mt-0.5 text-xs font-semibold text-ink-900">2 minimums met</p>
                  </div>
                  <div className="mt-3 rounded-full bg-brand-600 py-2 text-center text-xs font-semibold text-white">Prepare my CV</div>
                  <div className="mt-1.5 rounded-full bg-white py-2 text-center text-xs font-semibold text-ink-900 shadow-[0_0_0_1px_rgb(15_23_42/0.1)]">Fill their form</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQs */}
        <section id="faqs" aria-labelledby="faq-title" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
          <div className="mx-auto max-w-[820px] px-5 lg:px-8">
            <h2 id="faq-title" className={H2}>
              Questions, answered.
            </h2>
            <div className="mt-10 border-t border-ink-200">
              {FAQ.map((f) => (
                <details key={f.q} className="lp-row group border-b border-ink-200">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.0625rem] font-semibold leading-6 text-ink-900 sm:text-[1.1875rem]">
                    {f.q}
                    <Add size={20} className="lp-plus shrink-0 text-ink-500 transition-transform duration-200" />
                  </summary>
                  <p className="lp-swap pb-6 pr-10 text-[1.0625rem] leading-7 text-ink-600">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-[1.0625rem] leading-7">
              <Link href="/legal/privacy" className="group inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700 underline-offset-4 hover:underline">
                How {APP_NAME} handles your information
                <ArrowRight size={18} className="nudge" />
              </Link>
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------- Final actions */}
        <section aria-labelledby="cta-title" className={`${WRAP} py-16 lg:py-24`}>
          <div className="lp-stage rounded-[36px] px-6 py-16 text-center text-white lg:py-24">
            <h2 id="cta-title" className="mx-auto max-w-[18ch] font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3.5rem]">
              Check a job or add an application.
            </h2>
            <p className="mx-auto mt-5 max-w-[36rem] text-[1.0625rem] leading-7 text-white/85 lg:text-[1.1875rem] lg:leading-8">Check a job you are considering or add an application you have already sent. Keep the details ready for whatever comes next.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/check" className={`${BTN} min-h-14 bg-white px-7 text-[1.0625rem] text-brand-800 hover:bg-brand-50`}>
                Check a job
              </Link>
              <Link href="/applications/new" prefetch={false} className={`${BTN} min-h-14 border border-white/35 bg-white/10 px-7 text-[1.0625rem] text-white hover:bg-white/20`}>
                Track my applications
              </Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">No account needed for a quick check. Sign in to keep your records.</p>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="border-t border-ink-100 bg-ink-50 text-ink-600">
        <div className={`${WRAP} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]`}>
          <div>
            <Logo size={30} />
            <p className="mt-4 max-w-sm text-sm leading-6">
              {APP_NAME} helps you check opportunities and keep track of what you applied for, what you sent and what happened next.
            </p>
            <p className="mt-4 font-display text-[1.0625rem] font-semibold text-ink-900">{APP.tagline}</p>
          </div>
          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-ink-900">Product</h2>
            <ul className="mt-3 text-sm">
              {[
                ["Job checks", "#job-checks"],
                ["My Applications", "#records"],
                ["My Experience", "#prepare"],
                ["Tailored CVs", "#prepare"],
                ["Jobs for You", "#jobs-for-you"],
                ["Interview practice", "#interview"],
              ].map(([l, h]) => (
                <li key={l}>
                  <a href={h} className="inline-flex min-h-9 items-center hover:text-ink-950">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Help">
            <h2 className="text-sm font-semibold text-ink-900">Help</h2>
            <ul className="mt-3 text-sm">
              <li>
                <a href="#faqs" className="inline-flex min-h-9 items-center hover:text-ink-950">
                  Help
                </a>
              </li>
              <li>
                <a href={`mailto:${APP.support_email}`} className="inline-flex min-h-9 items-center hover:text-ink-950">
                  Contact support
                </a>
              </li>
              <li>
                <Link href="/extension" prefetch={false} className="inline-flex min-h-9 items-center hover:text-ink-950">
                  Extension setup
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="inline-flex min-h-9 items-center hover:text-ink-950">
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="inline-flex min-h-9 items-center hover:text-ink-950">
                  Terms of use
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-ink-150">
          <p className={`${WRAP} py-6 text-xs leading-5 text-ink-500`}>
            © {new Date().getFullYear()} {APP_NAME}. Made in Lagos. The examples on this page are illustrative and use a fictional employer.
          </p>
        </div>
      </footer>
    </div>
  );
}
