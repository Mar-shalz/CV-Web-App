"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { DocumentText, Microphone, Paperclip2, TickCircle } from "@/components/icons";

// The landing page's worked example (founder round 50): one fictional application, made with
// a CV from elsewhere. Its job copy and CV stay with it, and moving it to Interview brings
// the same two documents into a practice question. Nothing here is saved or sent anywhere.

const STATUSES = ["Not sent yet", "Sent", "Test", "Interview", "Offer", "No reply", "Not selected"] as const;
type Status = (typeof STATUSES)[number];
const TONE: Record<Status, string> = {
  "Not sent yet": "bg-ink-100 text-ink-800",
  Sent: "bg-brand-50 text-brand-800",
  Test: "bg-brand-50 text-brand-800",
  Interview: "bg-proof-50 text-proof-700",
  Offer: "bg-proof-50 text-proof-700",
  "No reply": "bg-ink-100 text-ink-700",
  "Not selected": "bg-ink-100 text-ink-700",
};
const TABS = [
  { id: "job", label: "Job description", icon: DocumentText },
  { id: "cv", label: "CV used", icon: Paperclip2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function RecordSample() {
  const uid = useId();
  const [tab, setTab] = useState<Tab>("job");
  const [status, setStatus] = useState<Status>("Sent");
  const [moved, setMoved] = useState(false);

  // "See an interview example" links to #interview-example: move the record there.
  useEffect(() => {
    const sync = () => {
      if (location.hash !== "#interview-example") return;
      setStatus("Interview");
      setMoved(true);
    };
    sync();
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tab === "job" ? "cv" : "job";
    setTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <div id="interview-example" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_40px_80px_-40px_rgb(15_23_42/0.28)] sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">Illustrative example</span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">CV prepared elsewhere</span>
      </div>
      <p className="mt-4 font-display text-[1.375rem] font-semibold leading-7 tracking-[-0.02em] text-ink-900">Graduate Trainee, Finance</p>
      <p className="text-[0.9375rem] leading-6 text-ink-600">Northbridge Bank</p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-ink-100 py-5 text-[0.9375rem]">
        <div>
          <dt className="text-[0.8125rem] text-ink-500">Date sent</dt>
          <dd className="mt-0.5 font-medium text-ink-900">3 November 2026</dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-ink-500">How I applied</dt>
          <dd className="mt-0.5 font-medium text-ink-900">Email</dd>
        </div>
        <div className="col-span-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <dt className="text-[0.8125rem] text-ink-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors duration-200 ${TONE[status]}`}>
                <TickCircle size={16} variant="bulk" />
                {status}
              </span>
            </dd>
          </div>
          <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-600">
            Move to
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Status);
                setMoved(true);
              }}
              className="min-h-12 rounded-full border border-ink-200 bg-white pl-4 text-[0.9375rem] font-semibold text-ink-900"
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </dl>
      <p role="status" className="sr-only">
        {moved ? `Example moved to ${status}.` : ""}
      </p>

      <div role="tablist" aria-label="What this application keeps" onKeyDown={onKeys} className="lp-segment mt-5 grid grid-cols-2 rounded-full p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-semibold transition-[background-color,color,box-shadow] duration-200 ${tab === t.id ? "bg-white text-ink-900 shadow-[0_1px_3px_rgb(15_23_42/0.16)]" : "text-ink-600 hover:text-ink-900"}`}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} tabIndex={0} className="lp-swap mt-3 rounded-2xl border border-paper-edge bg-paper p-4 text-[0.9375rem] leading-6 text-ink-800 sm:p-5">
        {tab === "job" ? (
          <>
            <p className="font-semibold text-ink-900">Saved copy of the ad</p>
            <p className="mt-2">Northbridge Bank invites applications for its Graduate Trainee Programme, Finance. Applicants need a Second Class Upper degree and an NYSC discharge or exemption certificate. Send your CV by email with the subject GTP 2026 Finance.</p>
            <p className="mt-3 text-[0.8125rem] leading-5 text-ink-500">Saved on 3 November 2026. This copy stays with the application if the original post is removed.</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-ink-900">Tolu_Adebayo_CV.pdf</p>
            <p className="mt-2">Tolu Adebayo. BSc Accounting, Second Class Upper. NYSC, Lagos: updated daily attendance records in Excel and flagged missing entries for weekly reporting.</p>
            <p className="mt-3 text-[0.8125rem] leading-5 text-ink-500">Prepared outside Aptbrix and added with this application. A later edit to your experience does not change this file.</p>
          </>
        )}
      </div>

      <ol className="mt-5 space-y-2 text-[0.875rem] leading-5 text-ink-600">
        <li className="flex gap-3">
          <span className="w-16 shrink-0 text-ink-500">3 Nov</span>
          Marked as sent. This is your own confirmation, not proof of delivery.
        </li>
        {moved && status !== "Sent" ? (
          <li className="lp-swap flex gap-3">
            <span className="w-16 shrink-0 text-ink-500">Today</span>
            Moved to {status}.
          </li>
        ) : null}
      </ol>

      {status === "Interview" ? (
        <div className="lp-reveal mt-5 rounded-2xl bg-brand-950 p-5 text-white">
          <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-sky-300">
            <Microphone size={18} variant="bulk" />
            Practice question 1 of 7
          </p>
          <p className="mt-2 text-[1.0625rem] leading-7">Your CV says you flagged missing entries in the attendance records during NYSC. How did you find them?</p>
          <p className="mt-3 text-[0.8125rem] leading-5 text-white/70">Asked from the saved job and the CV you sent. In the app you answer by voice or by typing.</p>
        </div>
      ) : null}
    </div>
  );
}
