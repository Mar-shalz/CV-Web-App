"use client";

import { useActionState, useState } from "react";
import { saveSetup, type FormState } from "@/app/(auth)/actions";
import { Award, Book1, Briefcase, Chart2, TickCircle, Mobile } from "@/components/icons";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Option = { id: string; label: string };
type Country = { code: string; label: string; profile: string | null };

const STAGE_ICON: Record<string, typeof Book1> = {
  final_year: Book1,
  nysc: Award,
  graduate_0_3: Briefcase,
  experienced_3_plus: Chart2,
};

const tile =
  "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[0.9375rem] font-medium transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500";

export function SetupForm({ stages, regions, countries, maxCountries }: { stages: Option[]; regions: Option[]; countries: Country[]; maxCountries: number }) {
  const [state, action] = useActionState<FormState, FormData>(saveSetup, undefined);
  const [region, setRegion] = useState<string>("nigeria");
  const [picked, setPicked] = useState<string[]>([]);
  const [stage, setStage] = useState<string>("");
  const [lowData, setLowData] = useState(false);
  const [tried, setTried] = useState(false);

  // Nigeria counts as one of the markets when applying at home and abroad.
  const abroadLimit = region === "both" ? maxCountries - 1 : maxCountries;
  const abroad = countries.filter((c) => c.code !== "NG");
  const needCountries = region !== "nigeria" && picked.length === 0;
  const ready = Boolean(stage) && !needCountries;
  const fe = {
    career_stage: (tried && !stage ? "Choose the option that fits you best." : undefined) ?? state?.fieldErrors?.career_stage,
    countries: (tried && needCountries ? "Pick at least one country abroad." : undefined) ?? state?.fieldErrors?.countries,
  };

  function toggle(code: string) {
    setPicked((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : cur.length >= abroadLimit ? cur : [...cur, code]));
  }

  return (
    <form action={action} className="space-y-8" noValidate>
      <FormError message={state?.error} />

      <fieldset aria-describedby={fe.career_stage ? "stage-error" : undefined}>
        <legend className="text-sm font-semibold text-ink-900">Which best describes you?</legend>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {stages.map((s) => {
            const Icon = STAGE_ICON[s.id] ?? Briefcase;
            const on = stage === s.id;
            return (
              <label key={s.id} className={`${tile} min-h-16 ${on ? "border-brand-500 bg-brand-50/70 text-brand-900" : "border-transparent bg-ink-75 text-ink-900 hover:bg-ink-100"}`}>
                <input type="radio" name="career_stage" value={s.id} checked={on} onChange={() => setStage(s.id)} className="sr-only" />
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-brand-600 text-white" : "bg-white text-ink-600"}`}>
                  <Icon size={20} variant={on ? "bulk" : "linear"} />
                </span>
                <span className="leading-5">{s.label}</span>
              </label>
            );
          })}
        </div>
        {fe.career_stage ? (
          <div className="mt-2">
            <FieldError id="stage-error">{fe.career_stage}</FieldError>
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink-900">Where are you applying?</legend>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-ink-75 p-1">
          {regions.map((r) => (
            <label
              key={r.id}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl text-[0.9375rem] font-medium text-ink-600 transition-all duration-200 has-[:checked]:bg-white has-[:checked]:font-semibold has-[:checked]:text-ink-900 has-[:checked]:shadow-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500"
            >
              <input
                type="radio"
                name="region"
                value={r.id}
                checked={region === r.id}
                onChange={() => {
                  setRegion(r.id);
                  setPicked((cur) => cur.slice(0, r.id === "both" ? maxCountries - 1 : maxCountries));
                }}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      {region !== "nigeria" ? (
        <fieldset aria-describedby="countries-hint" className="animate-rise">
          <legend className="text-sm font-semibold text-ink-900">Which countries abroad?</legend>
          <p id="countries-hint" className="mt-1 text-[0.8125rem] text-ink-500" aria-live="polite">
            Pick up to {abroadLimit}. {picked.length} of {abroadLimit} chosen.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {abroad.map((c) => {
              const on = picked.includes(c.code);
              const full = !on && picked.length >= abroadLimit;
              return (
                <label
                  key={c.code}
                  className={`inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-medium transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${
                    on ? "border-brand-600 bg-brand-600 text-white" : full ? "cursor-not-allowed border-transparent bg-ink-75 text-ink-400" : "border-transparent bg-ink-75 text-ink-800 hover:bg-ink-100"
                  }`}
                >
                  <input type="checkbox" name="countries" value={c.code} checked={on} disabled={full} onChange={() => toggle(c.code)} className="sr-only" />
                  {on ? <TickCircle size={18} variant="bulk" /> : null}
                  {c.label}
                </label>
              );
            })}
          </div>
          {fe.countries ? (
            <div className="mt-2">
              <FieldError>{fe.countries}</FieldError>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-ink-75 p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500">
        <span className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-ink-600">
            <Mobile size={20} />
          </span>
          <span>
            <span className="block text-[0.9375rem] font-semibold text-ink-900">Data saver</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-5 text-ink-600">Lighter pages and smaller files. Good for small data bundles.</span>
          </span>
        </span>
        <span className="relative inline-flex shrink-0">
          <input type="checkbox" name="low_data_mode" role="switch" checked={lowData} onChange={(e) => setLowData(e.target.checked)} className="peer sr-only" />
          <span className="h-8 w-14 rounded-full bg-ink-300 transition-colors duration-200 peer-checked:bg-brand-600" aria-hidden="true" />
          <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6" aria-hidden="true" />
        </span>
      </label>

      <SubmitButton size="lg" className="w-full" pendingLabel="Saving" inactive={!ready} onInactiveClick={() => setTried(true)}>
        Finish setup
      </SubmitButton>
    </form>
  );
}
