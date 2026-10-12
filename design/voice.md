# Voice and UX writing guide

Version 0.2, 12 October 2026. Applies to every screen, email, error and generated text. The product name is a placeholder: write so that a rename changes nothing.

## 1. Who we're talking to

Tolu, 21 to 27, NYSC or new graduate, on an Android phone with a small data bundle, often reading in a noisy place, often anxious after months of silence from employers. Tolu is an adult under pressure, not a beginner.

## 2. Voice: a sharp older cousin who works in HR

| We are | We are not |
|---|---|
| Direct: the answer first | Vague, hedged, padded |
| Warm: on your side, never shaming | Cold or clinical |
| Specific: names, numbers, next step | Generic praise ("Great job!") |
| Honest: we say what we can't prove | Hype, guarantees, fear ("Beat the ATS") |
| Nigerian English: NYSC, PPA, 2:1, naira | Slang, Americanisms, jargon |

Tone shifts with the moment, voice does not:

| Moment | Tone | Example |
|---|---|---|
| Good news | Plain, quick | "Apply. You meet every hard requirement." |
| Hard news | Calm, kind, a next step | "Skip this one. They need a 2:1 and you have a 2:2. Your time is better spent on roles like these." |
| Danger | Firm, no drama | "Check this before you share anything. This post asks for a payment to apply." |
| Waiting | Reassuring, short | "Checking official sources" |
| Error | Own it, fix it | "We couldn't save this job. Check your connection and try again. Your text is still here." |

## 3. Rules for every line

1. **Answer first, explain second.** Headline says the outcome; the line under it says why.
2. **One idea per sentence.** Aim for 20 words or fewer.
3. **Active voice, present tense.** "We check the job", not "The job will be checked".
4. **Buttons are verb + object, in the user's words.** "Tailor my CV", "Send me a code", "Check this job", "Agree and continue". Never "Submit", "OK", "Click here".
5. **Say what happens next.** Under a main button, one line on what the next screen does.
6. **Never blame.** "That code didn't work", not "You entered a wrong code".
7. **Errors have three parts:** what happened, why if useful, what to do. Never a code number alone.
8. **Inactive buttons explain themselves.** A tap on a grey button shows exactly what's missing.
9. **No em dashes, no banned words** (spearheaded, leveraged, synergy, dynamic, results driven, passionate about, seamlessly, proven track record, in today's fast paced world). `npm run lint:copy` enforces it.
10. **British spelling.** organise, programme, licence (noun).
11. **Numbers:** digits always ("3 days", "5 CVs"). Naira as ₦5,000. Dates as 12 Oct 2026, in Lagos time. No percentages on user screens for match or fit.
12. **Links describe the destination.** "How we protect your data", never "Learn more".

## 4. Words we use

| Use | Avoid | Why |
|---|---|---|
| Tailor my CV | Optimise, boost, generate | Users' own words for the job |
| Job description | JD, posting, listing | Plain and searchable |
| My experience | Vault, profile | Says what it holds (code keeps "vault") |
| Apply / Apply with care / Skip this one | Match score, low match, not qualified | Advice, not a grade |
| Invited | Shortlisted (on buttons) | What people say out loud |
| Not selected | Rejected, failed | Same fact, no shame |
| No reply | Ghosted, no response | Neutral |
| Looks genuine / Couldn't verify / Red flags found | Safe, legit, scam (about a company) | We describe the post, never accuse an employer |
| Data saver | Low data mode | Benefit, not mechanism |
| Sign in or create an account | Log in / Register (two paths) | One passwordless path |
| Interview prep | Shortlist mode | Says what it does (code keeps "shortlist") |
| Interview notes | Debrief | Plain for first time job seekers (code keeps "debrief") |
| Practise / practice | Drill | Less military, clearer for readers abroad |
| The job post you saved | Snapshot | Says what it is |
| Check if you qualify | Eligibility | Everyday words |
| Must haves | Hard requirements, hard filters | Everyday words |
| Join the waiting list | Be first in the door | Idioms don't travel; readers abroad and second language readers |
| Any news on these applications? | Heard back yet? (card title) | Founder asked for no title on the card; the line says what to do |

## 5. Microcopy library

| Place | Copy |
|---|---|
| Sign in title | Let's get you started |
| Sign in subtitle | Sign in or create an account. It takes less than a minute. |
| Email hint | We'll send you a 6 digit code. No password needed. |
| Email error | Enter an email address like name@gmail.com |
| Code title | Check your email |
| Code resend | Didn't get it? Resend in 24s / Resend code |
| Consent title | Your data, your choice |
| Setup title | Set up your job search |
| Home hero | Found a job you like? Let's tailor your CV to it. |
| Home drop area | Paste or upload a job description |
| Capture next step | Next, we check if you qualify and if the job looks genuine. Free, even after your trial. |
| Paste too short | This looks a bit short. Paste the whole job description, including requirements and how to apply. |
| Link fallback | Some sites, like LinkedIn, need a login. If we can't open the link, you can paste the text instead without starting over. |
| Verdict note | This is advice, not a decision. You can always apply anyway. |
| Flagged number | This line has a number you did not give us. Add the real figure or remove it before you download. |
| Flagged ownership | This line says you led this. Your notes say you helped. |
| Pre download | Check these lines first? An interviewer could ask about any line. |
| Pack subject note | Use this exactly. The employer asked for this format. |
| Check in | Heard back yet? Tap one answer for each. After 30 days with no reply, we mark it for you. |
| Sent | Application saved. We kept the job post and the exact CV you sent. |
| Offline | You are offline. Your work is saved on this phone and will sync when you are back. |

## 6. Accessibility in words

- Every icon has a word next to it or an sr-only label. Status is never colour or icon alone.
- Labels sit above fields, never only as placeholders.
- Form errors are announced (`role="alert"`) and say how to fix it.
- Links opening a new tab say so to screen readers.
- Write for a reading age of about 12: short words win.
