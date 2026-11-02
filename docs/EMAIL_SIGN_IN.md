# Email sign in: send a 6 digit code (founder round 40, D-211)

## Why the email only has a link

The app already asks Supabase for a code (`signInWithOtp`, then `verifyOtp` with the 6 digits). What the email says comes from Supabase's email template, and the default template only has the sign in link. Supabase's built in email service has two limits:

1. The email templates can't be edited until a custom SMTP server is set (D-069).
2. It only delivers to members of the Supabase project's team. Anyone else who signs up with email gets nothing. The founder's address works because the founder is on the team.

So custom SMTP fixes both: real users get the email, and the template can carry the code.

## Steps (about 20 minutes)

1. **Pick an email sender.**
   - Resend (3,000 emails a month free) or Brevo (300 a day free). Both work with Supabase.
   - Best: send from your own domain (for example `no-reply@receipts.ng`). Add the DNS records the sender gives you (SPF, DKIM) so emails don't land in spam. A `vercel.app` address can't be used, because you can't add DNS records to it.
2. **Turn on custom SMTP.** In Supabase, open Authentication, then Emails, then SMTP Settings. Turn on "Enable custom SMTP" and enter the sender's host, port, username and password (an SMTP key, never your account password). Set the sender name to `Receipts` and the sender email to your address on that domain.
3. **Raise the email rate limit.** Authentication, then Rate Limits: set "Rate limit for sending emails" to at least 30 an hour (Supabase starts custom SMTP at 30).
4. **Edit two templates.** Authentication, then Emails, then Templates. For both **Magic link** and **Confirm signup**:
   - Subject: `Your Receipts sign in code: {{ .Token }}`
   - Body: paste all of `supabase/templates/sign-in-code.html`.
   New people get "Confirm signup" and returning people get "Magic link", so both need the code.
5. **Check the code length.** Authentication, then Sign In / Providers, then Email: "Email OTP Length" must be 6, to match `config/limits.json` (auth.otp_length).
6. **Test.** Sign out, sign in with an email that is not on the Supabase team, and enter the code.

The link in the email keeps working too, as before.
