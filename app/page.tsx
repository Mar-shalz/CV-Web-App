import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/brand/logo";
import {
  ArrowRight,
  ShieldSearch,
  Magicpen,
  Send2,
  DocumentUpload,
  TickCircle,
  CloseCircle,
  Messages2,
  Microphone,
  Global,
  Lock1,
  Danger,
  Timer1,
  Chart,
  Sms,
  ShieldTick,
  Verify,
  Teacher,
  Add,
} from "@/components/icons";
import { APP, APP_NAME } from "@/lib/config";

// The landing page (founder round 31): what the product does, shown with real screens
// from the app (sample data, fictional employer), in plain words. No prices while the app
// is open (D-196). Motion is CSS only and stops for reduced motion or data saving.

const SITE = (APP as { app_url?: string }).app_url ?? "https://applywithproof.vercel.app";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: Apply with proof. Check jobs, tailor your CV, ace the interview` },
  description:
    "Check if a job is real, see how well you match, and send a CV built only from what you've actually done. Then practise for the interview one question at a time. Made for job seekers in Nigeria and beyond.",
  alternates: { canonical: "/" },
};

const FAQ = [
  {
    q: "Will it make things up on my CV?",
    a: "No. Every line on your CV traces back to something you told us and confirmed. If a line has a detail we can't trace, it's flagged so you can fix it before you send. Rewritten lines are suggestions until you accept them.",
  },
  {
    q: "How do you check if a job is real?",
    a: "We look up the company, how long it has been around, whether the email and apply link are on its own website, whether the job was posted by the company or a known job board, public scam reports, and any request for money. We show each check, and we never call a job safe: we tell you what we found.",
  },
  {
    q: "Does it send applications for me?",
    a: "Never. We prepare everything the employer asked for, in the format they asked for it, and you press Send yourself. Your name stays yours.",
  },
  {
    q: "Does it work for jobs abroad?",
    a: "Yes. Each job gets the CV format its country expects: Nigerian private sector, Nigerian graduate programmes, UK CVs and US resumes. NYSC and HND are explained in a line for employers abroad.",
  },
  {
    q: "What happens to my data?",
    a: "Your CV file is read once and not kept; only what you confirm is saved. Sensitive details like date of birth are encrypted and never go on a CV unless you switch them on for one job. You can download or delete everything at any time.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. It's built phone first, light on data, and you can install it like an app. On a laptop, our Chrome extension reads jobs straight from LinkedIn and other sites.",
  },
  {
    q: "What's the Chrome extension for?",
    a: "It sits beside any job page, even ones behind a sign in like LinkedIn. It reads the job, checks if it's real, shows your match, writes your CV, and attaches it in Gmail for you.",
  },
];

const STEPS = [
  { icon: DocumentUpload, title: "Bring any job", body: "Paste the text, share a link, upload a PDF, or snap the flyer from your WhatsApp group." },
  { icon: ShieldSearch, title: "Know before you apply", body: "Is it real? Do you qualify? How well do you match? Answers in under a minute." },
  { icon: Magicpen, title: "Get a CV that holds up", body: "Written for this job from your real experience, in the format the employer expects." },
  { icon: Send2, title: "Send, then get ready", body: "The exact email they asked for, and a mock interview when the invite comes." },
];

const NEVERS = [
  "Add a number, employer, title or grade you didn't give us",
  "Call a job safe when we can't prove it",
  "Send anything to an employer for you",
  "Tell you to hide your age, grade or NYSC status",
];

const PLACES = ["LinkedIn", "Jobberman", "MyJobMag", "Indeed", "Company career pages", "WhatsApp job flyers", "Graduate trainee programmes", "NYSC and SIWES", "UK CVs", "US resumes", "Banks", "Oil and gas", "Tech", "NGOs", "Telcos", "Consulting"];

const PEOPLE = ["Final year students", "Corps members", "Graduate trainees", "Career switchers", "First job hunters", "Early career professionals", "Going abroad"];

type Feature = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  alt: string;
  tag: { icon: typeof ShieldSearch; label: string; sub: string };
  halo: string;
};

const FEATURES: Feature[] = [
  {
    id: "job-check",
    eyebrow: "Is this job real?",
    title: "Spot a fake job before it costs you",
    body: "Fake recruiters and pay-to-apply scams are everywhere. We run the checks a careful friend in HR would, and show you every one.",
    points: ["The company exists, and how long it has been around", "The email and link are on its own website", "Posted by the company or a known job board", "Any request for money, flagged at once"],
    image: "/landing/real.jpg",
    alt: "The job check screen: 5 of 6 checks passed, the company exists, has been around since 2004, and its email is on its own website.",
    tag: { icon: ShieldTick, label: "5 of 6 checks passed", sub: "Never says 'safe'. Shows what it found." },
    halo: "bg-proof-400",
  },
  {
    id: "match",
    eyebrow: "Your match",
    title: "Know where you stand in one look",
    body: "Hard requirements like class of degree, NYSC, age and licences are checked by rules, not guesswork. Then you see how well your experience fits, and what to say about the gaps.",
    points: ["Apply, apply with care, or skip, with the reason", "A clear match score for every job", "Add a skill you have in one tap"],
    image: "/landing/fit.jpg",
    alt: "The fit check screen for a Graduate Trainee role: the advice is Apply, with a 78% match to the job.",
    tag: { icon: Chart, label: "78% match", sub: "Advice, not a decision. You choose." },
    halo: "bg-brand-400",
  },
  {
    id: "cv",
    eyebrow: "Tailored CV",
    title: "A CV that holds up in the interview",
    body: "We rewrite your CV for each job using the job's own words, so hiring software and recruiters find what they look for. Only from what you've really done.",
    points: ["Every line traced to your experience", "You accept each change, or keep your own words", "Four designs hiring software can read", "Nigerian, UK and US formats, PDF or Word"],
    image: "/landing/cv.jpg",
    alt: "A tailored CV for Tolu Adebayo with a suggested profile summary to accept, keep or edit.",
    tag: { icon: Verify, label: "Every line traced", sub: "Nothing made up. Ever." },
    halo: "bg-sky-400",
  },
  {
    id: "send",
    eyebrow: "Ready to send",
    title: "Send it exactly the way they asked",
    body: "One wrong subject line and an application is ignored. We copy the employer's format to the letter, write the email for this job, and list every document they asked for.",
    points: ["The exact subject line they asked for", "An email written for this job, yours to edit", "Send via Gmail with your CV attached"],
    image: "/landing/send.jpg",
    alt: "The Ready to Send screen with the email address, the subject line in the employer's format and the message.",
    tag: { icon: Sms, label: "GTP2026: Tolu Adebayo, Accounting", sub: "Their format, to the letter" },
    halo: "bg-indigo-400",
  },
  {
    id: "interview",
    eyebrow: "Mock interview",
    title: "Practise like it's the real thing",
    body: "When the invite comes, practise with an interviewer who listens. One question at a time, and the next one builds on what you just said, like a real panel.",
    points: ["Follow-up questions from your own answers", "Feedback checked against the CV you sent", "Answer by voice or by typing", "A checklist for the day"],
    image: "/landing/interview.jpg",
    alt: "The mock interview screen: a follow-up question built on the candidate's last answer, with a tip on how to answer.",
    tag: { icon: Microphone, label: "Question 2 of 7", sub: "Built on your last answer" },
    halo: "bg-violet-400",
  },
];

function Phone({ src, alt, priority = false, className = "" }: { src: string; alt: string; priority?: boolean; className?: string }) {
  return (
    <div className={`lp-phone ${className}`}>
      <Image src={src} alt={alt} width={750} height={1624} priority={priority} sizes="(min-width: 1024px) 300px, 70vw" />
    </div>
  );
}

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
        description: APP.promise,
        featureList: ["Job scam check", "Eligibility and match check", "Tailored CV with fact lock", "Application email in the employer's format", "Mock interview with follow-up questions", "Chrome extension for LinkedIn and Gmail"],
      },
      { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <div className="min-h-dvh bg-white text-ink-900">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ------------------------------------------------------------- Hero */}
      <header className="lp-night">
        <div className="lp-grid" aria-hidden="true" />
        <div className="lp-blob left-[-10%] top-[-12%] size-[520px] bg-[#2f5ef0]" aria-hidden="true" />
        <div className="lp-blob right-[-12%] top-[10%] size-[460px] bg-[#0ea5e9]" style={{ animationDuration: "28s" }} aria-hidden="true" />
        <div className="lp-blob bottom-[-20%] left-[30%] size-[480px] bg-[#7c3aed] opacity-40" style={{ animationDuration: "34s", animationDirection: "alternate-reverse" }} aria-hidden="true" />

        <nav aria-label="Main" className="sticky top-0 z-40 px-3 pt-3 lg:px-6">
          <div className="lp-glass mx-auto flex max-w-[1200px] items-center justify-between gap-3 rounded-2xl px-3 py-2 lg:px-4">
            <Link href="/" aria-label={`${APP_NAME} home`} className="rounded-xl">
              <Logo tone="onDark" size={32} />
            </Link>
            <ul className="hidden items-center gap-1 text-[0.9375rem] font-medium text-white/85 lg:flex">
              {[
                ["How it works", "#how"],
                ["Features", "#features"],
                ["Job check", "#job-check"],
                ["Extension", "#extension"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-11 items-center rounded-xl px-3.5 hover:bg-white/10 hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <Link href="/sign-in" className="hidden min-h-11 items-center rounded-xl px-4 text-[0.9375rem] font-semibold text-white/90 hover:bg-white/10 sm:inline-flex">
                Sign in
              </Link>
              <Link href="/sign-in" className="cta-sheen inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3.5 text-[0.9375rem] font-semibold text-brand-800 hover:bg-brand-50 sm:px-4">
                Get started
                <ArrowRight size={18} className="hidden sm:block" />
              </Link>
              <details className="relative lg:hidden">
                <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-xl text-white hover:bg-white/10" aria-label="Menu">
                  <span aria-hidden="true" className="flex flex-col gap-1.5">
                    <span className="block h-0.5 w-5 rounded bg-white" />
                    <span className="block h-0.5 w-5 rounded bg-white" />
                  </span>
                </summary>
                <ul className="lp-glass absolute right-0 top-14 w-56 rounded-2xl p-2 text-[0.9375rem] font-medium">
                  {[
                    ["How it works", "#how"],
                    ["Features", "#features"],
                    ["Job check", "#job-check"],
                    ["Extension", "#extension"],
                    ["FAQ", "#faq"],
                    ["Sign in", "/sign-in"],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a href={href} className="flex min-h-11 items-center rounded-xl px-3 text-white hover:bg-white/10">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </nav>

        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-20">
          <div className="animate-rise">
            <p className="lp-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] font-medium text-white/90">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-proof-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-proof-400" />
              </span>
              Early access: every feature is open
            </p>
            <h1 className="mt-6 font-display text-[3rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[4rem] lg:text-[5.25rem]">
              <span className="lp-gradient-text">Apply with proof.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-7 text-white/85 lg:text-xl lg:leading-8">
              Find out if a job is real, see how well you fit, and send a CV built only from what you&apos;ve actually done. Then walk into the interview ready.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-in" className="cta-sheen inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-[1.0625rem] font-semibold text-brand-800 shadow-[0_18px_40px_-16px_rgb(125_211_252/0.6)] hover:bg-brand-50">
                Get started
                <ArrowRight size={20} />
              </Link>
              <a href="#how" className="lp-glass inline-flex min-h-14 items-center justify-center rounded-2xl px-7 text-[1.0625rem] font-semibold text-white hover:bg-white/20">
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
              {["Nothing made up", "You press Send", "Works on any phone"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <TickCircle size={16} variant="bulk" className="text-proof-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* A real screen from the app, with the moments that matter floating around it. */}
          <div className="relative mx-auto w-full max-w-[420px] animate-rise" style={{ animationDelay: "150ms" }}>
            <div className="absolute inset-x-6 top-10 bottom-10 rounded-[48px] bg-[#3b82f6] opacity-40 blur-3xl" aria-hidden="true" />
            <Phone src="/landing/fit.jpg" alt="The app's fit check: advice to apply, with a 78% match to a Graduate Trainee role." priority className="relative mx-auto w-[78%]" />
            <div className="lp-glass-deep lp-float absolute -left-2 top-[14%] w-48 rounded-2xl p-3 sm:-left-8" style={{ ["--d" as string]: "0s" }} aria-hidden="true">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                <ShieldTick size={16} variant="bulk" className="text-proof-400" />
                Is this job real?
              </p>
              <p className="mt-1 text-[0.9375rem] font-semibold">5 of 6 checks passed</p>
              <div className="mt-2 flex gap-1">
                {[1, 1, 1, 1, 1, 0].map((on, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${on ? "bg-proof-400" : "bg-white/25"}`} />
                ))}
              </div>
            </div>
            <div className="lp-glass-deep lp-float absolute -right-2 top-[40%] w-44 rounded-2xl p-3 sm:-right-8" style={{ ["--d" as string]: "1.6s" }} aria-hidden="true">
              <p className="text-xs font-semibold text-white/80">Your match</p>
              <p className="mt-0.5 font-display text-2xl font-semibold">78%</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/20">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-proof-400 to-sky-300" />
              </div>
            </div>
            <div className="lp-glass-deep lp-float absolute -left-2 bottom-[16%] w-52 rounded-2xl p-3 sm:-left-10" style={{ ["--d" as string]: "3.1s" }} aria-hidden="true">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                <Verify size={16} variant="bulk" className="text-sky-300" />
                CV ready
              </p>
              <p className="mt-1 text-[0.8125rem] leading-5 text-white/90">Every line traced to your own experience</p>
            </div>
            <div className="lp-glass-deep lp-float absolute -right-1 bottom-[4%] w-44 rounded-2xl p-3 sm:-right-6" style={{ ["--d" as string]: "4.4s" }} aria-hidden="true">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                <Microphone size={16} variant="bulk" className="text-violet-300" />
                Mock interview
              </p>
              <p className="mt-1 text-[0.9375rem] font-semibold">Question 3 of 7</p>
            </div>
          </div>
        </div>

        {/* Where it works, drifting past. */}
        <div className="lp-marquee border-t border-white/10 py-5" aria-label="Works with jobs from">
          <ul className="lp-marquee-track gap-3">
            {[...PLACES, ...PLACES].map((p, i) => (
              <li key={`${p}-${i}`} aria-hidden={i >= PLACES.length || undefined} className="whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/75">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main id="main">
        {/* ------------------------------------------------------- Problem */}
        <section aria-labelledby="why-title" className="mx-auto max-w-[1200px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="lp-reveal max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Why good candidates get ignored</p>
            <h2 id="why-title" className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] lg:text-[3.25rem]">
              Most applications disappear. <span className="lp-ink-gradient">Yours don&apos;t have to.</span>
            </h2>
          </div>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: Danger, tint: "bg-flag-50 text-flag-600", title: "Fake jobs are everywhere", body: "Pay-to-apply scams and fake recruiters cost money and hope. Most people only find out after they've paid." },
              { icon: Timer1, tint: "bg-care-50 text-care-600", title: "One CV for every job", body: "Hiring software skips CVs that don't use the job's own words. A good candidate looks like a poor match." },
              { icon: Messages2, tint: "bg-brand-50 text-brand-700", title: "Invites come weeks later", body: "By the time they call, the post is gone and you can't remember exactly what you sent." },
            ].map((c) => (
              <li key={c.title} className="lp-reveal group rounded-[28px] border border-ink-150 bg-white p-7 shadow-card transition-transform duration-300 hover:-translate-y-1">
                <span className={`grid size-12 place-items-center rounded-2xl ${c.tint}`}>
                  <c.icon size={24} variant="bulk" />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.01em]">{c.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- How it works */}
        <section id="how" aria-labelledby="how-title" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-[#f4f7ff] to-white py-20 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
            <div className="lp-reveal mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">How it works</p>
              <h2 id="how-title" className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] lg:text-[3.25rem]">
                From job post to interview, in four moves
              </h2>
            </div>
            <ol className="relative mt-16 grid gap-5 lg:grid-cols-4">
              <span className="lp-dash absolute left-[12%] right-[12%] top-[38px] hidden h-0.5 lg:block" aria-hidden="true" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-reveal relative">
                  <div className="relative mx-auto grid size-[76px] place-items-center rounded-[26px] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-[0_18px_40px_-18px_rgb(30_71_217/0.7)] lg:mx-0">
                    <s.icon size={32} variant="bulk" />
                    <span className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-white font-display text-sm font-semibold text-brand-700 shadow-card">{i + 1}</span>
                  </div>
                  <div className="lp-glass-light mt-6 rounded-[24px] p-6 text-center lg:text-left">
                    <h3 className="text-lg font-semibold tracking-[-0.01em]">{s.title}</h3>
                    <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------------- Features */}
        <section id="features" aria-label="Features" className="scroll-mt-24">
          {FEATURES.map((f, i) => (
            <article key={f.id} id={f.id} aria-labelledby={`${f.id}-title`} className="mx-auto grid max-w-[1200px] scroll-mt-24 items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:py-24">
              <div className={`lp-reveal ${i % 2 ? "lg:order-2" : ""}`}>
                <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-brand-700">
                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-[0.6875rem] font-bold text-white">{i + 1}</span>
                  {f.eyebrow}
                </p>
                <h2 id={`${f.id}-title`} className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] lg:text-[2.75rem]">
                  {f.title}
                </h2>
                <p className="mt-4 max-w-xl text-[1.0625rem] leading-7 text-ink-600">{f.body}</p>
                <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 rounded-2xl border border-ink-150 bg-white p-3.5 text-[0.9375rem] leading-6 shadow-card">
                      <TickCircle size={20} variant="bulk" className="mt-0.5 shrink-0 text-proof-600" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`lp-reveal relative mx-auto w-full max-w-[380px] ${i % 2 ? "lg:order-1" : ""}`}>
                <div className={`lp-halo ${f.halo}`} aria-hidden="true" />
                <Phone src={f.image} alt={f.alt} className="mx-auto w-[82%]" />
                <div className={`lp-glass-light lp-float absolute ${i % 2 ? "-right-2 sm:-right-6" : "-left-2 sm:-left-6"} bottom-[12%] max-w-[230px] rounded-2xl p-3.5`} style={{ ["--d" as string]: `${i * 0.7}s` }} aria-hidden="true">
                  <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900">
                    <f.tag.icon size={18} variant="bulk" className="shrink-0 text-brand-600" />
                    {f.tag.label}
                  </p>
                  <p className="mt-1 text-xs leading-4 text-ink-500">{f.tag.sub}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* ------------------------------------------------------- Promise */}
        <section aria-labelledby="promise-title" className="lp-night py-20 lg:py-28">
          <div className="lp-grid" aria-hidden="true" />
          <div className="lp-blob right-[-10%] top-[-30%] size-[520px] bg-[#2f5ef0]" aria-hidden="true" />
          <div className="lp-blob bottom-[-30%] left-[-10%] size-[420px] bg-[#0ea5e9] opacity-40" style={{ animationDuration: "30s" }} aria-hidden="true" />
          <div className="mx-auto grid max-w-[1200px] gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
            <div className="lp-reveal">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300">Our promise</p>
              <h2 id="promise-title" className="mt-3 font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.04em] lg:text-[3.75rem]">
                <span className="lp-gradient-text">Nothing made up. Ever.</span>
              </h2>
              <p className="mt-5 max-w-lg text-[1.0625rem] leading-7 text-white/80">
                Every line on your CV traces back to something you told us and confirmed. Interviewers ask about your CV, so it should only say what you can back up.
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-white/75">
                <Lock1 size={18} variant="bulk" className="text-sky-300" />
                Your CV file is read once and not kept.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {NEVERS.map((n) => (
                <li key={n} className="lp-reveal lp-glass flex items-start gap-3 rounded-[22px] p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                    <CloseCircle size={22} variant="bulk" className="text-flag-400" />
                  </span>
                  <p className="text-[0.9375rem] leading-6 text-white/90">
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">We never</span>
                    {n}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------------- Extension */}
        <section id="extension" aria-labelledby="ext-title" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="lp-reveal">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Chrome extension</p>
              <h2 id="ext-title" className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] lg:text-[3.25rem]">
                Works right where you find jobs
              </h2>
              <p className="mt-4 max-w-xl text-[1.0625rem] leading-7 text-ink-600">
                On a laptop, a side panel sits beside any job page, even LinkedIn behind your sign in. It reads the job you opened, checks it, shows your match, writes your CV, and attaches it in Gmail for you.
              </p>
              <ol className="mt-7 space-y-3">
                {["Open any job on LinkedIn or any job site", "Click the extension: the job is read for you", "Check, tailor and send without switching tabs"].map((t, i) => (
                  <li key={t} className="flex items-center gap-3 text-[0.9375rem] font-medium">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <Link href="/extension" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-brand-600 px-5 font-semibold text-brand-700 hover:bg-brand-50">
                <Global size={20} variant="bulk" />
                Get the Chrome extension
              </Link>
            </div>
            {/* A browser window drawn in HTML: a job page and the side panel beside it. */}
            <div className="lp-reveal relative min-w-0" aria-hidden="true">
              <div className="lp-halo bg-brand-300" />
              <div className="overflow-hidden rounded-[22px] border border-ink-150 bg-white shadow-[0_40px_90px_-40px_rgb(30_71_217/0.45)]">
                <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-3">
                  <span className="size-3 rounded-full bg-flag-400" />
                  <span className="size-3 rounded-full bg-care-400" />
                  <span className="size-3 rounded-full bg-proof-400" />
                  <span className="ml-3 min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-1.5 text-xs text-ink-500">linkedin.com/jobs/view/graduate-trainee-finance</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_190px] sm:grid-cols-[minmax(0,1fr)_230px]">
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-2/3 rounded bg-ink-150" />
                    <div className="h-3 w-1/3 rounded bg-ink-100" />
                    <div className="mt-5 space-y-2">
                      {[92, 84, 88, 70, 80, 60, 76].map((w, i) => (
                        <div key={i} className="h-2.5 rounded bg-ink-100" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="border-l border-ink-100 bg-[#f6f8ff] p-3.5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brand-700">{APP_NAME}</p>
                    <p className="mt-1 text-sm font-semibold">Graduate Trainee, Finance</p>
                    <div className="mt-3 rounded-xl bg-white p-2.5 shadow-card">
                      <p className="flex items-center gap-1 text-[0.6875rem] font-semibold text-proof-700">
                        <ShieldTick size={14} variant="bulk" />5 of 6 checks passed
                      </p>
                      <div className="mt-1.5 flex gap-0.5">
                        {[1, 1, 1, 1, 1, 0].map((on, i) => (
                          <span key={i} className={`h-1 flex-1 rounded-full ${on ? "bg-proof-500" : "bg-ink-150"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl bg-white p-2.5 shadow-card">
                      <p className="text-[0.6875rem] font-semibold text-ink-700">78% match</p>
                      <div className="mt-1.5 h-1 rounded-full bg-ink-100">
                        <div className="h-full w-[78%] rounded-full bg-proof-500" />
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-brand-600 py-2 text-center text-[0.75rem] font-semibold text-white">Tailor my CV</div>
                    <div className="mt-1.5 rounded-xl border border-brand-200 bg-white py-2 text-center text-[0.75rem] font-semibold text-brand-700">Send via Gmail</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- For who */}
        <section aria-labelledby="who-title" className="bg-gradient-to-b from-white to-[#f4f7ff] py-16 lg:py-20">
          <div className="lp-reveal mx-auto max-w-[900px] px-5 text-center lg:px-8">
            <h2 id="who-title" className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] lg:text-[2.25rem]">
              Built for anyone looking for their next job
            </h2>
            <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
              {PEOPLE.map((p) => (
                <li key={p} className="lp-glass-light flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.9375rem] font-medium">
                  <Teacher size={18} variant="bulk" className="text-brand-600" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-[860px] scroll-mt-24 px-5 py-20 lg:px-8 lg:py-28">
          <div className="lp-reveal text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">Questions</p>
            <h2 id="faq-title" className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] lg:text-[3rem]">
              Good to know
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="lp-faq lp-reveal group rounded-[22px] border border-ink-150 bg-white shadow-card open:shadow-raised">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-[1.0625rem] font-semibold">
                  {f.q}
                  <span className="lp-faq-icon grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-transform duration-300">
                    <Add size={18} />
                  </span>
                </summary>
                <p className="px-6 pb-6 text-[0.9375rem] leading-7 text-ink-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ Final CTA */}
        <section aria-labelledby="cta-title" className="px-3 pb-3 lg:px-4 lg:pb-4">
          <div className="aurora relative overflow-hidden rounded-[32px] px-6 py-16 text-center text-white lg:py-24">
            <div className="aurora-floor" aria-hidden="true" />
            <h2 id="cta-title" className="lp-reveal mx-auto max-w-3xl font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.04em] lg:text-[4rem]">
              Your next application deserves proof.
            </h2>
            <p className="lp-reveal mx-auto mt-5 max-w-xl text-[1.0625rem] leading-7 text-white/85">Check your next job, see your match and get your CV ready in minutes.</p>
            <Link href="/sign-in" className="cta-sheen lp-reveal mt-9 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-8 text-[1.0625rem] font-semibold text-brand-800 hover:bg-brand-50">
              Get started
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="bg-[#050b24] text-white/75">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <Logo tone="onDark" size={32} />
            <p className="mt-4 max-w-xs text-sm leading-6">{APP.promise}</p>
            <p className="mt-4 flex items-center gap-2 text-sm">
              <ShieldTick size={18} variant="bulk" className="text-proof-400" />
              We never send anything to employers for you.
            </p>
          </div>
          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-white">Product</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ["How it works", "#how"],
                ["Is this job real?", "#job-check"],
                ["Your match", "#match"],
                ["Tailored CVs", "#cv"],
                ["Ready to send", "#send"],
                ["Mock interview", "#interview"],
              ].map(([l, h]) => (
                <li key={h}>
                  <a href={h} className="hover:text-white">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Get started">
            <h2 className="text-sm font-semibold text-white">Get started</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/sign-in" className="hover:text-white">
                  Create your account
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-white">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/extension" className="hover:text-white">
                  Chrome extension
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-white">
                  Questions
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Help and legal">
            <h2 className="text-sm font-semibold text-white">Help and legal</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href={`mailto:${APP.support_email}`} className="hover:text-white">
                  {APP.support_email}
                </a>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-white">
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-white">
                  Terms of use
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <p>
              © {new Date().getFullYear()} {APP_NAME}. {APP.tagline}
            </p>
            <p>Made in Lagos for job seekers everywhere. Screens show sample data.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
