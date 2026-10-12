# Receipts

Mobile web app (PWA) that helps Nigerian graduates decide whether to apply for a job, send a truthful tailored CV, keep a record of what they sent, and prepare when invited. Read `CLAUDE.md` first.

## Status

Slice 0 (Foundations) built: Next.js 16 PWA shell, design tokens and brand system, database schema with row level security, Google and email code sign in, consent, setup, Home, landing page with waitlist and price button, analytics allow list, the `lib/ai` module with cost logging, Sentry with personal data scrubbing, CI with the eval runner, unit tests. Still to prove on a real phone: sign in and consent at 360x640 on throttled 3G. See `DECISIONS_LOG.md`.

## Run locally

```bash
npm install
npm run dev
```

With no Supabase keys the app runs in preview mode: sample data and a click through sign in, marked by a banner. Add `/home?preview=new` to see a new user's Home.

## Connect Supabase

1. Create a project in the region nearest Lagos the provider offers.
2. Copy `.env.example` to `.env.local` and fill it in.
3. Apply `supabase/migrations/0001_init.sql` (`supabase db push`, or paste into the SQL editor).
4. Auth > Providers: enable Email and Google. Redirect URL: `https://<your-domain>/auth/callback`.
5. Auth > Email templates > Magic link: include `{{ .Token }}` so users get a 6 digit code, not a link.
6. Run `npm run test:db` to prove one user can't read another user's rows.

## Checks

```bash
npm run typecheck && npm test && npm run lint
npm run build && npm run check:size   # first load budget, 300KB per page
npm run evals                         # golden sets G1 to G5 (placeholder for now)
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.
