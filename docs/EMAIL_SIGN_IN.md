# Email sign in: send a 6 digit code (founder rounds 40, 44 and 45, D-211, D-215, D-216)

## Why codes don't arrive yet

The app already asks Supabase for a code (`signInWithOtp`, then `verifyOtp` with the 6 digits). Supabase sends the email. Its built in email service has two limits:

1. It only delivers to members of the Supabase project's team. Anyone else who signs in with email gets nothing. The founder's address works because the founder is on the team.
2. Its email templates can't be edited, and the default template only has a sign in link, no code.

Custom SMTP fixes both: Supabase sends through an email account you choose, real users get the email, and the template can carry the code. When a code can't be sent, the back office overview now says why under "Needs a look: sign in".

## Option A: free, no domain needed (Gmail)

Good for the beta: Gmail sends up to about 500 emails a day from a personal account, for free. Gmail's own servers send it, so it rarely lands in spam.

1. **Make a new Gmail account for the app**, for example `aptbrix.signin@gmail.com`. Don't use your personal Gmail: the app password below can read that whole mailbox.
2. **Turn on 2-Step Verification** on that new account (myaccount.google.com, Security). App passwords only appear after this.
3. **Make an app password.** Go to `https://myaccount.google.com/apppasswords`, name it `Supabase`, and copy the 16 character password. Google shows it only once.
4. **Turn on custom SMTP in Supabase.** Authentication, then Emails, then SMTP Settings. Turn on "Enable custom SMTP" and enter:
   - Sender email: the new Gmail address (it must be the same address, or Gmail changes it)
   - Sender name: `Aptbrix`
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: the new Gmail address
   - Password: the 16 character app password, without spaces
   Then press Save.
5. **Set the email rate limit.** Authentication, then Rate Limits: set "Rate limit for sending emails" to `20` an hour. That stays under Gmail's daily limit even on a busy day. Gmail stops all sending for up to a day if the limit is passed.
6. **Edit the templates** (steps below), then **test** (steps below).

Keep the app password in Supabase only. Never put it in the code, in Vercel or in a chat. To cut Supabase off, delete the app password at the same Google page.

## Option B: your own domain (when you have one)

When the app has its own domain (for example `aptbrix.com`), switch to an email service and send from `no-reply@` that domain. It looks more trustworthy and handles more volume.

- Resend: 3,000 emails a month free (100 a day). Brevo: 300 a day free.
- Add the DNS records the service gives you (SPF, DKIM, DMARC) so emails don't land in spam.
- A `vercel.app` address can't be used, because you can't add DNS records to it. A free Gmail address doesn't work with these services either: they swap it for their own address, which looks like spam.
- In Supabase SMTP Settings, enter the service's host, port, username and SMTP key (never your account password). Raise the rate limit to what the plan allows.

## Edit the templates (both options)

Authentication, then Emails, then Templates. For both **Magic link** and **Confirm signup**:

- Subject: `Your Aptbrix sign in code: {{ .Token }}`
- Body: paste all of `supabase/templates/sign-in-code.html`.

New people get "Confirm signup" and returning people get "Magic link", so both need the code. If the email still shows only a "Log In" link, the template wasn't saved: each template has its own Save button. Putting the code in the subject means people can read it from the phone's notification.

The template has no link on purpose (D-216). A link to the Supabase address from a Gmail sender looks like phishing to spam filters, and the link fails when it opens in a different browser from the one the sign in started in.

Check the code length: Authentication, then Sign In / Providers, then Email. "Email OTP Length" must be 6, to match `config/limits.json` (auth.otp_length).

## Test

Sign out. Sign in with an email that is not on the Supabase team (a friend's, or a second address of yours), then enter the code. If nothing arrives within a minute, check Spam and Promotions, then the back office overview for the reason.

## Landing in spam

A new Gmail sender with no history often lands in spam at first. What helps: the code only template (no link, no images), the sender name `Aptbrix`, and people tapping "Report not spam" (Gmail learns from it). Send a few test codes to your own Gmail and Yahoo addresses and mark them not spam. If most still land in spam after a week, move to Option B: a domain with SPF, DKIM and DMARC is what spam filters trust most.
