// What to tell someone when Supabase couldn't send their sign in code, and the short reason
// the back office sees (founder round 44, D-215). Before, every failure said "check your
// connection", even when the email service refused the address, so nobody knew to look.
// Never reveals whether an account exists: the back office's "no account" answer reads the
// same as any other failure.

export type SendError = { status?: number; code?: string } | null | undefined;
export type SendFailure = { reason: string; error?: string; fieldError?: string; report: boolean };

export const SEND_FAILED = "We couldn't send your code just now. Try again in a few minutes, or use Continue with Google.";
export const TOO_MANY = "Too many codes asked for. Wait a minute, then try again.";

export function sendFailure(err: SendError): SendFailure {
  const code = err?.code ?? "";
  const status = err?.status;
  if (status === 429 || code.startsWith("over_")) return { reason: code || "rate_limited", error: TOO_MANY, report: true };
  // Supabase found the address unusable (a made up domain, for example): the person can fix it.
  if (code === "email_address_invalid") return { reason: code, fieldError: "Check your email address. It should look like name@gmail.com", report: false };
  // email_address_not_authorized: Supabase's own email service, which only reaches the
  // project's team. unexpected_failure: the custom SMTP server refused (wrong password, limit).
  return { reason: code || (status ? `status_${status}` : "send_failed"), error: SEND_FAILED, report: true };
}
