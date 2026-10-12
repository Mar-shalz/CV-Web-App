# Go live: the founder's step by step guide

Everything in the code is built. These steps need your accounts, your money or your decisions. Do them in order: each one unlocks the next. Tick the boxes as you go.

Words you'll see:
- **Terminal**: the app on your Mac where you type commands. In the Claude app, use the Terminal tab, or open Terminal from Spotlight (Cmd + Space, type "Terminal").
- **The receipts folder**: `Desktop/CV Web App/receipts`. Commands below must run inside it. In Terminal, type `cd ~/Desktop/"CV Web App"/receipts` and press Enter first.
- **Secret**: a password for a service. Keep secrets in a password manager (1Password, Bitwarden or Apple Passwords). Never paste them into chat, email or WhatsApp.

---

## 0. Fix the database errors you saw

The errors ("type consent_type already exists", "relation rate_events already exists" and so on) mean **those files already ran successfully before**. Each file runs all or nothing, so nothing is half done. Running a file a second time is what fails.

- [ ] Open Supabase > your project > **SQL Editor** > **New query**.
- [ ] Open `supabase/verify_setup.sql` in a text editor, copy everything, paste it into the editor and press **Run**. It changes nothing; it lists each migration file as "applied" or "NOT APPLIED".
- [ ] For each file marked NOT APPLIED, in number order: open the file from `supabase/migrations/`, copy all of it, paste into a new query, press Run once. You should see "Success. No rows returned".
- [ ] Run `verify_setup.sql` again. All eight rows should say "applied".

Never run a file that already says "applied".

**Starting a brand new Supabase project instead?** Use the two all in one files: run `supabase/sql/app_schema.sql` first (everything the app needs), then `supabase/sql/back_office.sql` (staff roles, truth reports, AI cost log). Don't use them on a project that already ran the numbered files.

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

### Email sign in codes
- [ ] **Authentication > Sign In / Providers > Email**: make sure Email is on. Save.
- [ ] **Authentication > Emails > Templates**. Open **Magic Link**. Replace the message body with:
  ```html
  <h2>Your sign in code</h2>
  <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
  <p>It expires in 10 minutes. If you didn't ask for it, ignore this email.</p>
  ```
  Save. Do the same for the **Confirm signup** template (new users get that one).

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
  - `ANTHROPIC_API_KEY`: console.anthropic.com > **API Keys** > Create key. Also go to **Billing** and set a monthly spend limit.
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

---

## 5. Make yourself the owner of the back office (5 minutes)

- [ ] Open your live app and sign in once.
- [ ] Supabase > SQL Editor, run (with your email):
  ```sql
  insert into public.admin_members (user_id, role)
  select id, 'owner' from public.users where email = 'YOUR EMAIL HERE';
  ```
- [ ] Open `https://YOUR-ADDRESS/admin/mfa` and scan the code with an authenticator app (Google Authenticator or Microsoft Authenticator). The back office at `/admin` opens after that.

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
