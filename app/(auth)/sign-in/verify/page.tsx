import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { ArrowLeft } from "@/components/icons";
import { LIMITS } from "@/lib/config";

export const metadata: Metadata = { title: "Check your email" };

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "your email";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(user.length - 2, 6)))}@${domain}`;
}

export default async function VerifyPage() {
  const email = (await cookies()).get("rcpt_otp_email")?.value;
  if (!email) redirect("/sign-in");

  return (
    <AuthShell
      step={1}
      title="Check your email"
      subtitle={
        <>
          We sent an email to <span className="font-semibold text-ink-900">{maskEmail(email)}</span>. Enter the {LIMITS.auth.otp_length} digit code from it, or tap the sign in link in that email on this device.
        </>
      }
    >
      <VerifyForm codeLength={LIMITS.auth.otp_length} resendSeconds={LIMITS.auth.otp_resend_seconds} />
      <p className="mt-6 text-center">
        <Link href="/sign-in" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-600 hover:text-ink-900">
          <ArrowLeft size={18} />
          Use a different email
        </Link>
      </p>
    </AuthShell>
  );
}
