import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAuthShell } from "@/components/admin/admin-auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { ArrowLeft } from "@/components/icons";
import { LIMITS } from "@/lib/config";

export const metadata: Metadata = { title: "Check your email", robots: { index: false, follow: false } };

export default async function AdminVerifyPage() {
  const email = (await cookies()).get("rcpt_otp_email")?.value;
  if (!email) redirect("/admin/sign-in");

  return (
    <AdminAuthShell
      title="Check your email"
      subtitle={
        <>
          We sent an email to <span className="font-semibold text-ink-900">{email}</span>. Enter the {LIMITS.auth.otp_length} digit code from it, or tap the sign in link in that email on this device.
        </>
      }
    >
      <VerifyForm codeLength={LIMITS.auth.otp_length} resendSeconds={LIMITS.auth.otp_resend_seconds} />
      <p className="mt-6 text-center">
        <Link href="/admin/sign-in" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
          <ArrowLeft size={18} />
          Use a different email
        </Link>
      </p>
    </AdminAuthShell>
  );
}
