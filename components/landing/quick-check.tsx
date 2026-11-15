"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { quickCheck, type QuickState } from "@/app/check/actions";
import { DRAFT_KEY } from "@/lib/client/capture-draft";
import { ArrowRight, Danger, MinusCircle, TickCircle, Warning2 } from "@/components/icons";

// What the words of an ad can't show. Each needs a lookup, which the full check runs.
const NOT_CHECKED = ["The company exists, and how long it has been around", "The email and apply link are on the company's own website", "Where the job was posted", "Public warnings and scam reports"];

/** The public quick check form and its findings. The ad stays in the box after a check. */
export function QuickCheck() {
  const [state, action, pending] = useActionState<QuickState, FormData>(quickCheck, undefined);
  const [post, setPost] = useState("");
  const signals = state?.result?.signals;

  // Keep the ad for the full check after sign in: the job form restores this draft.
  const keep = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: post, url: "" }));
    } catch {}
  };

  return (
    <div>
      <form action={action} className="rounded-[28px] bg-white p-4 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_30px_60px_-30px_rgb(15_23_42/0.2)] sm:p-6">
        <label htmlFor="post" className="block text-[0.9375rem] font-semibold text-ink-900">
          The job ad
        </label>
        <textarea
          id="post"
          name="post"
          required
          rows={9}
          value={post}
          onChange={(e) => setPost(e.target.value)}
          aria-describedby={state?.error ? "post-error" : "post-hint"}
          aria-invalid={state?.error ? true : undefined}
          placeholder="Paste the whole ad here, with how to apply."
          className="mt-2 block w-full resize-y rounded-2xl bg-ink-75 p-4 text-base leading-6 text-ink-900 outline-none ring-1 ring-transparent transition-shadow duration-150 focus:bg-white focus:ring-2 focus:ring-brand-500"
        />
        {state?.error ? (
          <p id="post-error" role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-flag-700">
            <Danger size={18} className="mt-px shrink-0" />
            {state.error}
          </p>
        ) : (
          <p id="post-hint" className="mt-2 text-[0.8125rem] leading-5 text-ink-500">
            We read the words once and don&apos;t keep them.
          </p>
        )}
        <button type="submit" disabled={pending} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-7 text-[1.0625rem] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:bg-ink-150 disabled:text-ink-500 sm:w-auto">
          {pending ? "Checking the ad" : "Check this ad"}
        </button>
      </form>

      <div aria-live="polite">
        {signals ? (
          <section aria-labelledby="found-title" className="lp-swap mt-6 rounded-[28px] bg-white p-5 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_30px_60px_-30px_rgb(15_23_42/0.2)] sm:p-7">
            <h2 id="found-title" className="flex items-start gap-2.5 font-display text-[1.375rem] font-semibold leading-7 tracking-[-0.02em] text-ink-900">
              {signals.length ? <Warning2 size={26} variant="bulk" className="mt-0.5 shrink-0 text-care-600" /> : <TickCircle size={26} variant="bulk" className="mt-0.5 shrink-0 text-brand-600" />}
              {signals.length ? `${signals.length} warning ${signals.length === 1 ? "sign" : "signs"} in the words of this ad` : "No warning signs in the words of this ad"}
            </h2>
            {signals.length ? (
              <ul className="mt-5 space-y-3">
                {signals.map((s) => {
                  const red = s.severity === "red";
                  const Icon = red ? Danger : Warning2;
                  return (
                    <li key={s.id} className={`rounded-2xl p-4 ${red ? "bg-flag-50" : "bg-care-50"}`}>
                      <p className={`flex items-center gap-1.5 text-[0.8125rem] font-semibold ${red ? "text-flag-700" : "text-care-700"}`}>
                        <Icon size={18} variant="bulk" />
                        {red ? "Warning" : "Check this"}
                      </p>
                      <p className="mt-1.5 text-[0.9375rem] leading-6 text-ink-900">{s.text}</p>
                      {s.evidence ? <p className="mt-2 border-l-2 border-ink-300 pl-3 text-sm leading-5 text-ink-600">From the ad: &ldquo;{s.evidence}&rdquo;</p> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9375rem] leading-6 text-ink-600">That is not proof the job is genuine. The words of an ad can look fine while the company or the contact details are not what they claim.</p>
            )}

            <h3 className="mt-7 text-[0.9375rem] font-semibold text-ink-900">Not checked yet</h3>
            <ul className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
              {NOT_CHECKED.map((c) => (
                <li key={c} className="flex items-center justify-between gap-4 py-3 text-[0.9375rem] leading-6 text-ink-700">
                  {c}
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-medium text-ink-500">
                    <MinusCircle size={16} />
                    Not checked
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.9375rem] leading-6 text-ink-600">The full check looks these up and shows what it found, with the source. It is free. Sign in and your ad will be waiting.</p>
            <Link href="/jobs/real" prefetch={false} onClick={keep} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full border border-ink-200 bg-white px-6 text-[0.9375rem] font-semibold text-ink-900 transition-colors duration-150 hover:bg-ink-50">
              Run the full check
              <ArrowRight size={18} />
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}
