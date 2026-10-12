import type { Metadata } from "next";
import Link from "next/link";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { LEGAL } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ConsentSwitch } from "@/components/settings/settings-forms";
import { TickCircle } from "@/components/icons";

export const metadata: Metadata = { title: "Your consents" };

type C = { type: string; version: string; granted_at: string | null; withdrawn_at: string | null; created_at: string };

export default async function ConsentsPage() {
  const viewer = await requireReadyViewer();
  let latest = new Map<string, C>();
  if (!viewer.preview) {
    const supabase = await createClient();
    const { data } = await supabase.from("consents").select("type, version, granted_at, withdrawn_at, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false });
    for (const c of (data ?? []) as C[]) if (!latest.has(c.type)) latest.set(c.type, c);
  } else {
    const now = new Date().toISOString();
    latest = new Map([["terms", { type: "terms", version: LEGAL.consents.terms.version, granted_at: now, withdrawn_at: null, created_at: now }], ["privacy", { type: "privacy", version: LEGAL.consents.privacy.version, granted_at: now, withdrawn_at: null, created_at: now }]]);
  }
  const on = (t: string) => Boolean(latest.get(t)?.granted_at && !latest.get(t)?.withdrawn_at);

  return (
    <SettingsShell title="Your consents" intro="What you've agreed to, and when. Change the optional ones any time.">
      <section aria-labelledby="req-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card">
        <h2 id="req-title" className="text-[0.9375rem] font-semibold text-ink-900">
          Needed to use the app
        </h2>
        <ul className="mt-3 space-y-3">
          {(["terms", "privacy"] as const).map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-ink-700">
              <TickCircle size={18} variant="bulk" className="mt-0.5 shrink-0 text-proof-600" />
              <span>
                <Link href={`/legal/${t}`} className="font-semibold text-brand-700 hover:underline">
                  {t === "terms" ? "Terms of use" : "Privacy notice"}
                </Link>
                {latest.get(t)?.granted_at ? ` · agreed ${formatDate(latest.get(t)!.granted_at!)} (${latest.get(t)!.version})` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] leading-5 text-ink-500">
          To withdraw these, <Link href="/settings/data" className="font-semibold text-brand-700 hover:underline">delete your account</Link>.
        </p>
      </section>
      <section aria-labelledby="opt-title" className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-2 shadow-card">
        <h2 id="opt-title" className="px-3 pb-1 pt-3 text-[0.9375rem] font-semibold text-ink-900">
          Optional
        </h2>
        <ConsentSwitch type="sensitive_details" title="Sensitive details" body="Lets us keep the details a job's rules need, encrypted. Turning this off deletes them." initial={on("sensitive_details")} />
        <ConsentSwitch type="question_bank" title="Question bank" body="Share the questions from your debriefs, without your name or notes, so other graduates can practise." initial={on("question_bank")} />
        <ConsentSwitch type="marketing" title="News and tips" body="Occasional emails about new features and job hunting tips. Never shared." initial={on("marketing")} />
      </section>
    </SettingsShell>
  );
}
