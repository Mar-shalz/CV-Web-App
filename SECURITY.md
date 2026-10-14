# Security

How Receipts keeps people's data safe, what was checked on 14 Oct 2026 (founder round 14),
and what the founder must switch on outside the code. No system is unbreakable; the aim is
defence in depth, so one mistake never exposes people's data on its own.

## Architecture in one page

- **One web app** (Next.js on Vercel) for the app and the back office. Pages and actions run
  on the server; the browser only gets what the page shows.
- **Supabase** holds the data (Postgres), sign in (Google or a one time email code, no
  passwords) and private files (storage buckets).
- **Two keys.** The browser has only the public "anon" key, which can do nothing that row
  level security doesn't allow. The service role key, which bypasses it, lives only on the
  server (`lib/supabase/admin.ts`, marked `server-only`) and is used for the back office,
  cron jobs, the payment webhook and shared caches.
- **AI providers** (Gemini, Anthropic) get job posts, CV evidence and transcripts, never
  passwords or payment details. Audio is deleted after transcription.

## Controls in the code

| Area | Control |
| --- | --- |
| Data access | Row level security on every table (checked: none without it). People read and change only their own rows. Staff tables (`admin_members`, `audit_log`, `admin_messages`, `price_clicks`) are closed to the anon key entirely. |
| Files | Private buckets. Each person's files sit in a folder named with their user id, and the storage rules check that folder on read, upload, replace and delete. |
| Sign in | Supabase sessions, checked with `getUser()` (validated by the auth server, not just decoded). Errors never say whether an account exists. The email code lives in a short lived httpOnly cookie, never in the link. |
| Every request | Every API route and server action checks who is signed in and filters by their user id (checked one by one). Next.js blocks server actions from other sites. Session cookies are SameSite=Lax, so other sites can't post as you. |
| Back office | Its own sign in page and its own session (a separate cookie sent only to /admin pages, its own callback), so an app session never opens the back office. Team membership is checked on every page and action; two factor sign in (authenticator app, `aal2`) is required before anything opens; each role sees only what it needs; emails are masked for roles that don't need them; every action is written to the audit log. Pages are never indexed or cached. |
| Browser | Content Security Policy with a new nonce per page (no inline scripts), no framing (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), HSTS, `nosniff`, a strict referrer policy, and camera and microphone only for this site. |
| Input | Job posts, CVs, transcripts and pasted messages are treated as data, never as instructions to the AI (tagged with a per request code). Links are fetched only after checking they don't point at private or internal addresses (SSRF guard), with redirects checked at every hop and a size cap. Job boards are read from fixed public hosts. |
| Abuse | Per person limits on every AI feature (`lib/rate-limit.ts`); Supabase limits sign in codes. |
| Payments | Only the Paystack webhook unlocks a pass, after checking Paystack's HMAC SHA512 signature in constant time. Card details never touch our servers. |
| Secrets | Only the Supabase URL and anon key are public. Everything else is a server environment variable; `.env*` files are never committed. |
| Sensitive details | Date of birth, gender and state of origin are encrypted in their own table and only added to a CV with consent for that export. |
| Logs | No personal data in logs, errors or analytics; Sentry scrubs emails and codes from links. |
| Supply chain | CI fails on known high or critical vulnerabilities in shipped packages (`npm audit`). |

## Findings from this review

- **Fixed:** the CV download needed an "update" storage rule to replace a stored copy, and
  failed without it; downloads now come straight back and the rule is added (D-128).
- **Fixed:** the back office search for one person escapes wildcards, so typed text can't
  widen the search (D-132).
- **Accepted, low:** three moderate advisories in `sprintf-js`, used only by the command
  line part of `mammoth` (Word file reader), which the app never runs.
- **Accepted, by design:** the back office sign in page shows that a back office exists.
  Access still needs a team account and two factor sign in, and every action is logged.

## What the founder must switch on (outside the code)

1. **Supabase > Authentication > Multi-Factor**: TOTP on (the back office needs it).
2. **Supabase > Authentication > URL Configuration**: only your real domains in the redirect
   list (no wildcards).
3. **Supabase > Project Settings > API**: never share the service role key; rotate it if it
   was ever pasted anywhere public.
4. **Supabase > Database > Backups**: daily backups are on by default on paid plans; turn on
   point in time recovery before real users.
5. **Supabase > Database > Network restrictions** and **SSL enforcement**: on.
6. **Vercel**: mark `SUPABASE_SECRET_KEY`, `SENSITIVE_DATA_KEY_V1`, `PAYSTACK_SECRET_KEY`,
   `CRON_SECRET` and the AI keys as Sensitive; turn on two factor sign in for your Vercel,
   GitHub, Google and Supabase accounts.
7. **GitHub**: keep the repository private; turn on Dependabot alerts and secret scanning.
8. **Paystack**: two factor sign in; restrict the live secret key to the webhook only.
9. Before launch, pay for an independent penetration test and a DPCO review (Nigeria Data
   Protection Act 2023).
