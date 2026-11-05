# Email sign in: send a 6 digit code (founder rounds 40 and 44, D-211, D-215)

## Why codes don't arrive yet

The app already asks Supabase for a code (`signInWithOtp`, then `verifyOtp` with the 6 digits). Supabase sends the email. Its built in email service has two limits:

1. It only delivers to members of the Supabase project's team. Anyone else who signs in with email gets nothing. The founder's address works because the founder is on the team.
2. Its email templates can't be edited, and the default template only has a sign in link, no code.

Custom SMTP fixes both: Supabase sends through an email account you choose, real users get the email, and the template can carry the code. When a code can't be sent, the back office overview now says why under "Needs a look: sign in".

## Option A: free, no domain needed (Gmail)

Good for the beta: Gmail sends up to about 500 emails a day from a personal account, for free. Gmail's own servers send it, so it rarely lands in spam.

1. **Make a new Gmail account for the app**, for example `receipts.signin@gmail.com`. Don't use your personal Gmail: the app password below can read that whole mailbox.
2. **Turn on 2-Step Verification** on that new account (myaccount.google.com, Security). App passwords only appear after this.
3. **Make an app password.** Go to `https://myaccount.google.com/apppasswords`, name it `Supabase`, and copy the 16 character password. Google shows it only once.
4. **Turn on custom SMTP in Supabase.** Authentication, then Emails, then SMTP Settings. Turn on "Enable custom SMTP" and enter:
   - Sender email: the new Gmail address (it must be the same address, or Gmail changes it)
   - Sender name: `Receipts`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: the new Gmail address
   - Password: the 16 character app password, without spaces
   Then press Save.
5. **Set the email rate limit.** Authentication, then Rate Limits: set "Rate limit for sending emails" to `20` an hour. That stays under Gmail's daily limit even on a busy day. Gmail stops all sending for up to a day if the limit is passed.
6. **Edit the templates** (steps below), then **test** (steps below).

Keep the app password in Supabase only. Never put it in the code, in Vercel or in a chat. To cut Supabase off, delete the app password at the same Google page.

## Option B: your own domain (when you have one)

When the app has its own domain (for example `receipts.ng`), switch to an email service and send from `no-reply@` that domain. It looks more trustworthy and handles more volume.

- Resend: 3,000 emails a month free (100 a day). Brevo: 300 a day free.
- Add the DNS records the service gives you (SPF, DKIM, DMARC) so emails don't land in spam.
- A `vercel.app` address can't be used, because you can't add DNS records to it. A free Gmail address doesn't work with these services either: they swap it for their own address, which looks like spam.
- In Supabase SMTP Settings, enter the service's host, port, username and SMTP key (never your account password). Raise the rate limit to what the plan allows.

## Edit the templates (both options)

Authentication, then Emails, then Templates. For both **Magic link** and **Confirm signup**:

- Subject: `Your Receipts sign in code: {{ .Token }}`
- Body: paste all of `supabase/templates/sign-in-code.html`.

New people get "Confirm signup" and returning people get "Magic link", so both need the code. Putting the code in the subject means people can read it from the phone's notification.

Check the code length: Authentication, then Sign In / Providers, then Email. "Email OTP Length" must be 6, to match `config/limits.json` (auth.otp_length).

## Test

Sign out. Sign in with an email that is not on the Supabase team (a friend's, or a second address of yours), then enter the code. If nothing arrives within a minute, check Spam and Promotions, then the back office overview for the reason.

The link in the email keeps working too, as before. The code is the more reliable path on phones, because the link can open in a different browser from the one you started in.
