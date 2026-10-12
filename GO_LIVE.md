# Go live: the founder's checklist

Everything in the code is built. These steps need your accounts, money, or decisions. Do them in order: each one unlocks the next. Ticking a box here is the only record, so keep this file up to date.

## 1. Put the code on GitHub (15 minutes)

- [ ] Create a private GitHub repository.
- [ ] From the `receipts` folder: `git remote add origin <repo url>` then `git push -u origin slice-0-foundations`.
- [ ] Open a pull request into `main` so CI runs typecheck, tests, lint, build and the size budget.

## 2. Supabase: database, sign in, files (1 hour)

- [ ] Create a project. Pick the region nearest Lagos in the list.
- [ ] SQL editor: run every file in `supabase/migrations/` in order, `0001` to `0008`.
- [ ] Authentication > Providers: turn on Email. Turn off "Confirm email" links; we use 6 digit codes.
- [ ] Authentication > Email templates > Magic link: put `{{ .Token }}` in the body so people get a code.
- [ ] Authentication > SMTP: connect a sender (Resend, Postmark or Amazon SES). The built in sender is limited to a few emails an hour, which is not enough for real users.
- [ ] Google sign in: in Google Cloud, create an OAuth client (web). Authorised redirect URI: the callback URL Supabase shows under Providers > Google. Paste the client ID and secret into Supabase.
- [ ] Authentication > URL configuration: Site URL = your domain; add `https://<your-domain>/auth/callback` to redirect URLs.
- [ ] Install the Supabase CLI on your computer and run `npm run test:db`. It must pass: it proves users can't read each other's data, only Paystack can unlock a pass, and account deletion removes everything.

## 3. Keys and secrets (20 minutes)

Make each of these, then keep them in a password manager. Never paste them in chat or commit them.

- [ ] `SENSITIVE_DATA_KEY_V1`: run `openssl rand -base64 32`. If you lose it, encrypted details can't be read.
- [ ] `CRON_SECRET`: run `openssl rand -hex 32`.
- [ ] `ANTHROPIC_API_KEY`: console.anthropic.com. Set a monthly spend limit.
- [ ] `PAYSTACK_SECRET_KEY`: start with the `sk_test_` key.
- [ ] Optional: Sentry DSN (EU project) and PostHog EU key with `ANALYTICS_SALT` (`openssl rand -hex 16`).

## 4. Vercel: hosting (30 minutes)

- [ ] Import the GitHub repository. Set Root Directory to `receipts`.
- [ ] Add every variable from `.env.example`. `APP_URL` is your public address, for example `https://app.yourdomain.com`.
- [ ] Deploy, then add your domain.
- [ ] Check Settings > Cron Jobs lists `/api/cron/outcomes` (daily).

## 5. Make yourself staff (5 minutes)

- [ ] Sign in to the live app once.
- [ ] Supabase SQL editor: `insert into public.admin_members (user_id, role) select id, 'owner' from public.users where email = 'YOUR EMAIL';`
- [ ] Open `/admin/mfa` and set up two factor sign in. The back office stays hidden until you do.

## 6. Paystack (1 to 3 days, mostly waiting)

- [ ] Paystack dashboard > Settings > API Keys & Webhooks: webhook URL `https://<your-domain>/api/payments/paystack/webhook`.
- [ ] In test mode, buy the pass three ways: test card, bank transfer and USSD. Each must show "Payment confirmed" and the pass must appear in `/admin/payments`.
- [ ] Submit your business documents (CAC) to activate live mode. Then swap in the `sk_live_` key in Vercel.
- [ ] Refunds are by hand: refund in Paystack, then record it in `/admin/payments`.

## 7. Decisions only you can make

- [ ] Product name. "Receipts" is a placeholder in `config/app.json`.
- [ ] Speech provider for voice answers. Run the G4 benchmark (a global provider against at least one Nigeria tuned one). Tell the engineer which one; the adapter is a small file behind `lib/speech`. Until then, answers are typed.
- [ ] Push or WhatsApp check in reminders (PRD says at most one a week). None are sent yet; only the in app card. Choose a provider if you want them.
- [ ] Figma frames. Screens are built from the design tokens and logged "unstyled" (see `DECISIONS_LOG.md`). Link frames when you have them.

## 8. Legal and content (before any public launch)

- [ ] Buy a Lufga web font licence and replace the demo files in `app/fonts/` (D-018). The demo files can't ship.
- [ ] Have a licensed Data Protection Compliance Organisation (NDPC) review the privacy notice, terms and consent wording in `app/legal/`.
- [ ] Check every domain in `config/lists/government_agencies.json`. They are drafts. A wrong domain could mark a fake recruiter as real.
- [ ] Review `config/lists/scam_signals.json` and the eligibility rules in `config/rule_sets/` through `/admin/rules`.

## 9. Quality gates (1 to 2 weeks with beta users)

- [ ] Build the golden sets G1 to G5 in `evals/` from real CVs and job posts, with written permission from the owners. `npm run evals` must pass before any prompt or model change merges.
- [ ] Test each slice's "done when" on a real low end Android phone (Tecno, Infinix or Itel, 2 to 3GB RAM) on throttled 3G. Record a short screen video per slice. The key ones:
  - [ ] Sign in and consent at 360x640 on 3G.
  - [ ] Import a CV and reach 5 confirmed items.
  - [ ] Share a job post from WhatsApp straight into the app (install the app to the home screen first).
  - [ ] Job check under 15 seconds on 3G.
  - [ ] Both email routes (share to Gmail with the PDF, and open the mail app) send correctly from Gmail.
  - [ ] After "I've sent it", open the application in airplane mode: the job post and the CV still show.
  - [ ] Paste a real interview SMS and check the suggested update.
  - [ ] Pay with card, transfer and USSD in test mode.
- [ ] Watch `/admin/ai` for cost per active user against the budget in `config/limits.json`.
