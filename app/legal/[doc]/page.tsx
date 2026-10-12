import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { APP_NAME, LEGAL } from "@/lib/config";

// Plain language summaries. The full texts need review by a licensed data
// protection compliance organisation before launch (PRD, Privacy section).
const DOCS = {
  privacy: {
    title: "Privacy notice",
    version: LEGAL.consents.privacy.version,
    points: [
      "We keep your CV, the experience you add, the jobs you check and the applications you record, so the app can do its job.",
      "We never ask for your BVN, NIN, bank details or passport number.",
      "Date of birth, gender and state of origin are encrypted, asked for only when a job needs them, and go on a CV only when you say so for that CV.",
      "Voice recordings are deleted as soon as they are turned into text.",
      "We never sell your data and never train AI models on it without a separate, clear yes from you.",
      "Some processing happens outside Nigeria, with the providers listed below.",
      "You can export everything or delete your account from Settings. We complete both within 30 days.",
    ],
  },
  terms: {
    title: "Terms of use",
    version: LEGAL.consents.terms.version,
    points: [
      `You must be 18 or older to use ${APP_NAME}.`,
      "You send every application yourself. We never apply, email or message an employer for you.",
      "Our advice on a job is only advice. You can always apply anyway.",
      "Our scam check describes what a post shows. It can't prove a job is real or fake, so check before you share personal details or pay anything.",
      "You are responsible for what you send. We flag any CV line we can't trace to your own words.",
      "A pass is paid once, does not renew, and can be refunded within 7 days if you packed fewer than 3 applications.",
    ],
  },
} as const;

type DocKey = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc as DocKey]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc as DocKey];
  if (!d) notFound();

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex h-16 max-w-3xl items-center px-4">
        <Link href="/" aria-label={`${APP_NAME} home`}>
          <Logo size={28} />
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <p className="text-sm font-semibold text-care-700">Draft {d.version}. Final text after legal review.</p>
        <h1 className="mt-2 font-display text-[2rem] font-bold tracking-[-0.02em]">{d.title}</h1>
        <ul className="mt-6 space-y-4 text-[1.0625rem] leading-7 text-ink-800">
          {d.points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        {doc === "privacy" ? (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Who processes your data</h2>
            <ul className="mt-3 divide-y divide-ink-100 rounded-2xl border border-ink-200">
              {LEGAL.processors.map((p) => (
                <li key={p.name} className="p-4 text-[0.9375rem] leading-6">
                  <span className="font-semibold">{p.name}</span>: {p.purpose}. <span className="text-ink-600">{p.region}.</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
