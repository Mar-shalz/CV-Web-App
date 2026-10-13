# Receipts

Mobile web app (PWA) that helps Nigerian graduates decide whether to apply for a job, send a truthful tailored CV, keep a record of what they sent, and prepare when invited. Read `CLAUDE.md` first.

## Status

All MVP slices (0 to 10) are built: sign in and consent, the vault (CV import and story interview), job capture, eligibility, scam check and fit verdict, the tailored CV with the fact lock, the application pack and log, outcomes and check ins, Shortlist mode, Paystack payments, and Settings with data export and deletion. Each slice still needs its "done when" proved on a real low end Android phone and its eval gate run on the golden sets. See `DECISIONS_LOG.md`.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev:preview` (port 3001) always runs on sample data, even with real keys in `.env.local`, so screens can be reviewed without signing in. With no Supabase keys, `npm run dev` also runs in preview mode: sample data and a click through sign in, marked by a banner. Add `/home?preview=new` to see a new user's Home.

## Connect Supabase

1. Create a project in the region nearest Lagos the provider offers.
2. Run `npm run setup:env` (creates `.env.local` with generated secrets), then fill in the rest.
3. Apply every file in `supabase/migrations/` once, in date order (`supabase db push`, or paste each into the SQL editor). An "already exists" error means that file ran before.
4. Auth > Providers: enable Email and Google. Redirect URL: `https://<your-domain>/auth/callback`.
5. Auth > Email templates > Magic link: include `{{ .Token }}` so users get a 6 digit code, not a link.
6. Run `npm run test:db` to prove one user can't read another user's rows, payments unlock only through the service role, and account deletion removes everything.
7. Make yourself staff for the back office (SQL editor): `insert into public.admin_members (user_id, role) select id, 'owner' from public.users where email = 'you@example.com';` then set up two factor at `/admin/mfa`.

## SQL files

`supabase/migrations/` holds the whole database, in date order:
- `20261013000000_app_schema.sql`: everything the app needs (baseline, applied 13 Oct 2026).
- `20261013000100_back_office.sql`: staff roles, truth reports, AI call log, audit extras (baseline).
- `20261013000200_notifications.sql`: the Updates panel (personal notifications and back office announcements).
- `20261013000300_uploads_10mb.sql`: uploads up to 10MB, Word and text files allowed.

Run each file once, in order (SQL editor or `supabase db push`). Every later change is a new file with a later date; never edit an applied file.

## Payments (Paystack)

1. Put `PAYSTACK_SECRET_KEY` (start with `sk_test_`) and `APP_URL` in the environment.
2. Paystack dashboard > Settings > API Keys & Webhooks: webhook URL `https://<your-domain>/api/payments/paystack/webhook`.
3. Test card, bank transfer and USSD in test mode. Only the webhook unlocks a pass.

## Scheduled job

`vercel.json` runs `/api/cron/outcomes` daily to mark No reply after 30 days. Set `CRON_SECRET` in Vercel.

## Checks

```bash
npm run typecheck && npm test && npm run lint
npm run build && npm run check:size   # first load budget, 300KB per page
npm run evals                         # golden sets G1 to G5 (placeholder for now)
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.
