import { notFound, redirect } from "next/navigation";
import { getStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "@/components/admin/mfa-form";
import { ShieldTick } from "@/components/icons";

export const metadata = { title: "Two Factor Sign in" };

export default async function MfaPage() {
  const staff = await getStaff();
  if (!staff) notFound();
  if (staff.mfa) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp?.find((f) => f.status === "verified") ?? null;

  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-panel)] border border-ink-150 bg-white p-6 shadow-card lg:p-8">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <ShieldTick size={28} variant="bulk" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900">{verified ? "Confirm it's you" : "Protect the back office"}</h1>
      <p className="mt-1 text-[0.9375rem] leading-6 text-ink-600">
        {verified ? "Enter the code from your authenticator app." : "The back office shows real people's data, so every staff account uses two factor sign in."}
      </p>
      <div className="mt-6">
        <MfaForm factorId={verified?.id ?? null} />
      </div>
    </div>
  );
}
