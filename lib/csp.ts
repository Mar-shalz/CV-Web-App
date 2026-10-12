// Content Security Policy with a fresh nonce per request (Slice 10, closes D-007).
// Scripts run only with the nonce, or when loaded by a script that has it
// ('strict-dynamic'). Inline style attributes stay allowed: the UI uses them for
// animation delays and CSS variables, which can't run code.

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

export function buildCsp(nonce: string, env: { dev: boolean; supabaseUrl?: string; sentryDsn?: string }): string {
  const supabase = originOf(env.supabaseUrl);
  const sentry = originOf(env.sentryDsn);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    // Paystack checkout and Google sign in are reached by redirect after a form post.
    `form-action 'self' ${supabase} https://accounts.google.com https://checkout.paystack.com`,
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${env.dev ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self' ${supabase} https://eu.i.posthog.com ${sentry}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ]
    .map((d) => d.replace(/\s+/g, " ").trim())
    .join("; ");
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
