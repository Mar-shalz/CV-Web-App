# Go live: the founder's step by step guide

Everything in the code is built. These steps need your accounts, your money or your decisions. Do them in order: each one unlocks the next. Tick the boxes as you go.

Words you'll see:
- **Terminal**: the app on your Mac where you type commands. In the Claude app, use the Terminal tab, or open Terminal from Spotlight (Cmd + Space, type "Terminal").
- **The receipts folder**: `Desktop/CV Web App/receipts`. Commands below must run inside it. In Terminal, type `cd ~/Desktop/"CV Web App"/receipts` and press Enter first.
- **Secret**: a password for a service. Keep secrets in a password manager (1Password, Bitwarden or Apple Passwords). Never paste them into chat, email or WhatsApp.

---

## 0. Database

You ran the two baseline files, so the database matches `supabase/migrations/20261013000000_app_schema.sql` and `20261013000100_back_office.sql`. The old numbered files are gone from the project.

- [x] App schema and back office (done 13 Oct 2026).
- [ ] Run `supabase/migrations/20261013000200_notifications.sql` once in the SQL editor. It adds the Updates panel: messages from the back office, payment receipts, and pass and trial reminders. Until you run it, the panel shows only check ins.
- [ ] Run `supabase/migrations/20261013000300_uploads_10mb.sql` once. It lets uploads go up to 10MB and accepts Word and text files.
- [ ] Run `supabase/migrations/20261014000000_links_free_access_records.sql` once. In Finder it's in `Desktop/CV Web App/receipts/supabase/migrations`. Open it in TextEdit, select all, copy, paste into Supabase > **SQL Editor** > **New query**, press **Run**. It adds the portfolio and website fields, free access for family and testers, applications sent with a CV made elsewhere, interview questions from the web, full time, part time or contract on roles, paused accounts and paused team members, how often (and from which country) people use the app, deleted application counts, price button taps, the CV top-up, back office message drafts and history, and the order of achievements. It's safe to run again: run the whole file again after every update that changes it (last change: 15 Oct 2026, round 17: shareable checks, design counts and faster queries). Until you run it, those features fail to save.

From now on every database change comes as one new file in that folder with a later date in its name. Run each new file once, in date order. Never re-run an old one: "already exists" errors mean it ran before.

---

## 1. Put the code on GitHub (15 minutes)

Vercel (the hosting) reads your code from GitHub. The code's own repository is the `receipts` folder. Publish that folder, not its parent `CV Web App`: a repository made from the parent only stores an empty pointer to `receipts`, so none of the code reaches GitHub.

- [ ] Make a free account at github.com if you don't have one.
- [ ] Publish the `receipts` repository. Either:
  - **Ask Claude to do it** (fastest): Claude points `receipts` at your GitHub repository and pushes the code to its `main` branch. Or:
  - **GitHub Desktop**: **File > Add local repository** > choose the `receipts` folder > **Publish repository**, tick **Keep this code private**. Then switch to the `slice-0-foundations` branch and press **Publish branch**. On github.com, press **Compare & pull request**, **Create pull request**, **Merge pull request**.
- [ ] Check on github.com that you can open folders like `app` and `lib`. If `receipts` shows as a greyed folder you can't open, the parent folder was published instead.

---

## 2. Supabase: database and sign in (1 hour)

You already have a project. These steps finish its set up.

### Copy your project keys
- [ ] Supabase > **Project Settings > API Keys**. Note the **Publishable key** and the **Secret key** (press Reveal).
- [ ] **Project Settings > Data API**: note the **Project URL** (looks like `https://abcd.supabase.co`).
You'll paste these in step 3.

### Email sign in
- [ ] **Authentication > Sign In / Providers > Email**: make sure Email is on. Save.
- [ ] Nothing else is needed to start. Every sign in email has a link that signs people straight in, using Supabase's standard template. The app tells them to tap it.
- [ ] Later, when your own email sender is set up (next step), you can also show a 6 digit code in the email. On new free projects Supabase locks the templates until custom SMTP is on, which is why the template box would not save. Once custom SMTP is on: **Authentication > Emails > Templates** > **Magic Link**, and add this line to the body, keeping the link that's already there:
  ```html
  <p>Or enter this code: <strong>{{ .Token }}</strong></p>
  ```
  Save. Do the same for **Confirm signup**.

### Your own email sender (needed before real users)
Supabase's built in sender only allows a few emails an hour.
- [ ] You need a domain (for example from Namecheap or Whogohost). Make an account at **resend.com**, add your domain, and add the DNS records it shows at your domain seller. Wait until Resend says "Verified".
- [ ] Resend > **API Keys** > Create key.
- [ ] Supabase > **Authentication > Emails > SMTP Settings** > turn on custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender email `no-reply@yourdomain.com`, sender name = your product name. Save.

### Google sign in
- [ ] Go to console.cloud.google.com > create a project.
- [ ] **APIs & Services > OAuth consent screen**: External, app name, your support email. Save.
- [ ] **Credentials > Create credentials > OAuth client ID** > Web application.
- [ ] Supabase > **Authentication > Sign In / Providers > Google**: copy the **Callback URL** shown there. Back in Google, paste it under **Authorized redirect URIs**. Create.
- [ ] Copy Google's **Client ID** and **Client secret** into the Supabase Google provider page. Turn it on. Save.

### Where people land after signing in
- [ ] **Authentication > URL Configuration**: Site URL = your web address (use the Vercel address from step 4 until you have a domain). Add these redirect URLs:
  `https://YOUR-ADDRESS/auth/callback` and `http://localhost:3000/auth/callback`.

---

## 3. Keys and secrets (20 minutes)

- [ ] In Terminal, inside the receipts folder, run:
  ```bash
  npm run setup:env
  ```
  It creates a private file `.env.local` and fills in three secrets for you (the encryption key, the cron secret and the analytics salt) without showing them.
- [ ] Open `.env.local` in a text editor and fill in:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`: from step 2.
  - `GEMINI_API_KEY`: aistudio.google.com/apikey > **Create API key**. This runs every AI feature for free while you test. The free tier has daily limits and Google may use what's sent to improve its products, so test with your own CV or made up details, not real users' CVs.
  - `ANTHROPIC_API_KEY` (when you have funds): console.anthropic.com > **API Keys** > Create key, and set a monthly spend limit under **Billing**. With both keys in, Gemini runs first and Claude takes over if Gemini fails. To make Claude first, set `AI_PROVIDERS=anthropic,gemini`.
  - `PAYSTACK_SECRET_KEY`: from step 6 (start with the `sk_test_` key).
- [ ] Save a copy of `SENSITIVE_DATA_KEY_V1` in your password manager. **If it's lost, encrypted personal details can never be read again.**

---

## 4. Vercel: put the app online (30 minutes)

- [ ] Sign up at vercel.com with your GitHub account.
- [ ] **Add New > Project** > import your repository.
- [ ] **Root Directory**: leave it as `./` (the repository is the `receipts` folder itself). Framework: Next.js (picked for you).
- [ ] **Environment Variables**: open `.env.local`, copy everything, and paste it into the first Key box. Vercel splits it into separate variables for you. Delete any that are empty.
- [ ] Press **Deploy**. When it finishes you get an address like `your-app.vercel.app`.
- [ ] **Settings > Environment Variables**: set `APP_URL` to that address (with https://). Then **Deployments** > the latest one > **Redeploy**.
- [ ] Optional now, needed for launch: **Settings > Domains** > add your domain and follow the DNS steps. Then change `APP_URL` and the Supabase Site URL to it.
- [ ] **Settings > Cron Jobs** should list `/api/cron/outcomes` (it marks No reply after 30 days, once a day).
- [ ] **Settings > Deployment Protection**: turn **Vercel Authentication** off for production. While it's on, only people logged in to your Vercel account can open the app; everyone else sees a Vercel login page.
- [ ] **A clean address** (no `victor-ajibodu-s-projects`): **Settings > Domains** > **Add Domain**, type a free name such as `receipts-ng.vercel.app` (`applywithproof.vercel.app` and `receipts-cv.vercel.app` were also free on 13 Oct 2026), and save. Then set `APP_URL` to it, redeploy, and in Supabase **Authentication > URL Configuration** set the Site URL to it and add `https://NEW-ADDRESS/auth/callback` to the redirect URLs. The long address keeps working; share only the new one. A domain you buy (for example `receipts.ng`) replaces it later the same way.
- [ ] **Turn on billing for the Gemini key** (aistudio.google.com > your project > **Set up billing**). On the free tier, Google Search inside Gemini answers "quota exhausted", so the scam check can't look for public warnings or scam reports, and links from sites that block us can't be found through search. Everything else keeps working without it: the company record, its age, the email and apply link check, and job boards (LinkedIn, Greenhouse, Lever, Ashby, Workable, SmartRecruiters) are read without search. With billing on, search has a free daily allowance and then a small charge per search; set a budget alert in Google Cloud.
- [ ] Voice (the microphone) uses the same `GEMINI_API_KEY`. Nothing else to set. To switch voice off, add `SPEECH_PROVIDER=off`.
- [ ] Prices: the pass includes 30 tailored CVs, and a top-up adds 10 for ₦1,500. Change them in `config/prices.json` if you want different numbers.
- [ ] **Settings > Environment Variables**: make sure `GEMINI_API_KEY` is there (the same value as in `.env.local`), then redeploy. Without it, CV upload, job checks and tailoring fail on the live site. **Back office > AI Cost and Quality** shows whether this server has a key.

### Error alerts with Sentry (optional, free)
Sentry tells you when the app breaks for someone: which screen, which step, on which phone, and how many people it hit, so you can fix it before people complain. It never sees CV text or personal details: the app strips them before sending. The free Developer plan is enough for the beta.
- [ ] Sign up at sentry.io and choose the EU data region. Create a **Next.js** project.
- [ ] Copy the **DSN** it shows into Vercel as both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, then redeploy. With no DSN, error tracking stays off and nothing else changes.

---

## 5. The back office (5 minutes)

- [x] You are the owner (done 13 Oct 2026). To add another owner later, they sign in once, then run in the SQL Editor:
  ```sql
  insert into public.admin_members (user_id, role)
  select id, 'owner' from public.users where email = 'THEIR EMAIL HERE';
  ```
- [ ] Open `https://YOUR-ADDRESS/admin/sign-in`, the back office's own sign in (Google or an email code, no password). Signed out visits to `/admin` go there too. The back office has its own session: signing in there doesn't sign you in to the app, and the other way round. The first time, it asks you to set up two factor: scan the code with an authenticator app (Google Authenticator or Microsoft Authenticator). Every visit after that asks for the 6 digit code from the app. Bookmark it.
- [ ] Use the account that is on the team. Signed in with another account, the sign in page says so and offers **Use my team account**. To let another account in, add it in **Team and Access**.
- [ ] In Supabase > Authentication > URL Configuration, add `https://YOUR-ADDRESS/admin/auth/callback` to the redirect list, next to `https://YOUR-ADDRESS/auth/callback`. The back office has its own session (D-136), so without it Google sign in to the back office fails.
- [ ] **Users** shows everyone's full email (owner only), their plan, what they paid, how many days they used the app and when they were last active. Open a person to see their usage chart and payments, or to pause or delete the account.
- [ ] Free access for family and testers: **Back office > Payments > Free access for family and testers**. Type their email, choose how long, press **Give free access**. They get everything a pass gives the next time they sign in with that email.

---

## 6. Paystack payments (test now, live in 1 to 3 days)

- [ ] Sign up at paystack.com. You start in **Test mode**.
- [ ] **Settings > API Keys & Webhooks**: copy the **Test Secret Key** into Vercel as `PAYSTACK_SECRET_KEY`, then redeploy.
- [ ] Same page, **Test Webhook URL**: `https://YOUR-ADDRESS/api/payments/paystack/webhook`. Save.
- [ ] In your app, open the pass page and pay. On Paystack's test page use their test card `4084 0840 8408 4081`, any future expiry date, CVV `408`. The full list of test cards (PIN and OTP ones too) is at paystack.com/docs/payments/test-payments. Also try **Bank transfer** and **USSD**; test mode lets you simulate them.
- [ ] Each payment should end on "Payment confirmed", and appear in `/admin/payments`.
- [ ] To go live: Paystack > **Settings > Business** (compliance): upload your CAC documents, a director's ID and your bank account. After approval, put the **Live Secret Key** in Vercel and set the **Live Webhook URL** to the same address.
- [ ] Refunds: refund in the Paystack dashboard first, then record it in `/admin/payments`.

---

## 7. Decisions only you can make

Tell me your answer in chat and I'll build it.
- [ ] **Product name.** "Receipts" is a placeholder. Once you choose, I change it everywhere (it lives in `config/app.json`).
- [ ] **Voice answers.** Choose a speech to text provider. The fair way is the G4 test: record 20 Nigerian English answers, run them through 2 or 3 providers (a global one and one tuned for Nigeria) and count mistakes. Until then, people type.
- [ ] **Reminders outside the app.** Push notifications or WhatsApp check ins, at most once a week. Today only the in app card asks.
- [ ] **Figma.** If you have or commission screen designs, share the links and I'll match them.

---

## 8. Legal and content (before any public launch)

- [ ] **Font licence.** Buy the Lufga web licence from Fontspring (the seller of the files you sent). Send me the new `.woff2` files; the demo files can't go live.
- [ ] **Data protection review.** The Nigeria Data Protection Commission (NDPC) publishes a list of licensed Data Protection Compliance Organisations (DPCOs). Hire one to review the privacy notice, terms and consent wording (shown at `/legal/privacy` and `/legal/terms`). They'll also tell you whether to file a compliance audit.
- [ ] **Government agency list.** Open `config/lists/government_agencies.json`. For each agency, check its real website address. A wrong domain could make a fake recruiter look real. Send me corrections.
- [ ] **Rules and scam signals.** Read them in `/admin/rules` and approve or edit.

---

## 9. Test on real phones with beta users (1 to 2 weeks)

- [ ] On a low end Android phone (Tecno, Infinix or Itel), open your app in Chrome. Menu > **Install app** (or Add to Home screen).
- [ ] Turn off Wi-Fi and use mobile data, ideally where the signal is weak. On a laptop, Chrome's DevTools (Cmd + Option + I) > **Network** > **Slow 3G** also simulates it.
- [ ] Work through this list and note anything slow or confusing:
  - [ ] Sign in with an email code and with Google, then accept the terms.
  - [ ] Import an old CV and confirm at least 5 items.
  - [ ] In WhatsApp, long press a job post > Share > choose the app. The Tailor screen should open with the post.
  - [ ] Check a job: the result should come in under 15 seconds.
  - [ ] Get the tailored CV, then send it both ways: "Share CV to Gmail" and "Open my email app". Check the email that arrives.
  - [ ] Tap "I've sent it". Turn on airplane mode and open the application: the job post and CV must still show.
  - [ ] Paste a real interview SMS and check the suggested update.
  - [ ] Pay with card, transfer and USSD in test mode.
- [ ] **Test sets for quality checks (G1 to G5).** With written permission from the owners, collect about 30 real CVs and 50 real job posts (including a few known scams). Put them in a shared folder and tell me; I'll build the automatic checks that must pass before any AI change goes live.
- [ ] Watch `/admin/ai` for AI cost per active user against the budget in `config/limits.json`.
