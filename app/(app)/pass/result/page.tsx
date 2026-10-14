import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { PRICES } from "@/lib/config";
import { formatDate, formatNaira } from "@/lib/format";
import { AutoRefresh } from "@/components/pass/auto-refresh";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { TickCircle, Clock, Danger, Magicpen, Teacher, Repeat } from "@/components/icons";

export const metadata: Metadata = { title: "Payment" };

type View = { status: "active" | "pending" | "failed" | "missing"; type: string; amount: number; ends: string | null; applicationId: string | null; reference: string };

async function load(viewerId: string, preview: boolean, reference: string): Promise<View> {
  if (preview) {
    const type = reference.includes("interview_boost") ? "interview_boost" : "job_hunt_30d";
    return { status: "active", type, amount: PRICES.products[type].amount_kobo, ends: type === "job_hunt_30d" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null, applicationId: "r1", reference };
  }
  if (!/^rcp_[a-z0-9]{24,64}$/.test(reference)) return { status: "missing", type: "", amount: 0, ends: null, applicationId: null, reference };
  const supabase = await createClient();
  const { data } = await supabase.from("passes").select("status, type, amount_kobo, ends_at, application_id").eq("paystack_reference", reference).eq("user_id", viewerId).maybeSingle();
  if (!data) return { status: "missing", type: "", amount: 0, ends: null, applicationId: null, reference };
  const status = data.status === "active" ? "active" : data.status === "pending" ? "pending" : "failed";
  return { status, type: data.type, amount: data.amount_kobo, ends: data.ends_at, applicationId: data.application_id, reference };
}

/** Payment result (screen 24): success, pending and failed. Only the webhook sets success. */
export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const viewer = await requireReadyViewer();
  const sp = await searchParams;
  const reference = (sp.reference ?? sp.trxref ?? "").slice(0, 80);
  const v = await load(viewer.id, viewer.preview, reference);
  const label = v.type === "interview_boost" ? PRICES.products.interview_boost.label : PRICES.products.job_hunt_30d.label;

  return (
    <div className="mx-auto max-w-lg py-6">
      {v.status === "active" ? (
        <section className="relative animate-pop overflow-hidden rounded-[var(--radius-panel)] border border-proof-100 bg-white p-8 text-center shadow-raised" role="status">
          <div aria-hidden="true" className="confetti pointer-events-none absolute inset-0" />
          <span className="relative mx-auto grid size-20 place-items-center rounded-full bg-proof-600 text-white shadow-raised">
            <TickCircle size={44} variant="bulk" />
          </span>
          <h1 className="relative mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">Payment Confirmed</h1>
          <p className="relative mt-2 text-[0.9375rem] leading-6 text-ink-600">
            {label}, {formatNaira(v.amount)}.{v.ends ? ` Active until ${formatDate(v.ends)}.` : " Interview prep is unlocked for this invite."}
          </p>
          <div className="relative mt-6">
            {v.type === "interview_boost" && v.applicationId ? (
              <ButtonLink href={`/applications/${v.applicationId}/shortlist`} size="lg">
                <Teacher size={20} variant="bulk" />
                Prepare for the interview
              </ButtonLink>
            ) : (
              <ButtonLink href="/jobs/new" size="lg">
                <Magicpen size={20} variant="bulk" />
                Tailor my CV
              </ButtonLink>
            )}
          </div>
          <p className="relative mt-4 text-xs text-ink-500">Paystack also emails you a receipt.</p>
        </section>
      ) : v.status === "pending" ? (
        <section className="rounded-[var(--radius-panel)] border border-ink-150 bg-white p-8 text-center shadow-card" role="status" aria-live="polite">
          <span className="relative mx-auto grid size-20 place-items-center rounded-full bg-brand-50 text-brand-700">
            <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600 [animation-duration:1.4s]" />
            <Clock size={34} variant="bulk" />
          </span>
          <h1 className="mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">Confirming Your Payment</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">Card payments confirm in seconds. Bank transfers and USSD can take a few minutes. This page updates by itself.</p>
          <p className="mt-2 text-sm text-ink-500">You can leave this page. Your pass switches on as soon as Paystack confirms.</p>
          <AutoRefresh />
        </section>
      ) : (
        <section className="rounded-[var(--radius-panel)] border border-ink-150 bg-white p-8 text-center shadow-card" role="alert">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-flag-50 text-flag-700">
            <Danger size={40} variant="bulk" />
          </span>
          <h1 className="mt-5 font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">{v.status === "missing" ? "We can't find this payment" : "The payment didn't go through"}</h1>
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-600">
            {v.status === "missing" ? "The link may be incomplete. If you paid, your pass switches on by itself once Paystack confirms." : "Nothing was unlocked. If your bank still debited you, send us this reference and we'll sort it out."}
          </p>
          {v.reference ? (
            <div className="mx-auto mt-4 flex max-w-xs items-center justify-between gap-2 rounded-2xl bg-ink-50 py-1 pl-4 pr-1">
              <code className="truncate text-[0.8125rem] text-ink-700">{v.reference}</code>
              <CopyButton value={v.reference} label="reference" />
            </div>
          ) : null}
          <ButtonLink href="/pass" size="lg" className="mt-6">
            <Repeat size={20} />
            Try again
          </ButtonLink>
        </section>
      )}
    </div>
  );
}
