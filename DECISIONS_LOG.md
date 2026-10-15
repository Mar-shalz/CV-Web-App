# Decisions log

Choices the Build pack did not cover. Newest last. Each one is the simplest option that respects CLAUDE.md.

## Slice 0: Foundations (12 Oct 2026)

**D-000 Design source.** No Figma frames exist yet. The founder supplied three reference screenshots (a split access page with a blue gradient panel and step cards, a split sign in with a photo panel, and a care dashboard with a white sidebar and stat cards) and asked for the brand and screens to follow them. Built screens 1 to 4 (Welcome, Sign in code, Consent, Setup), 9 (Home) and the shell from that direction and `design/brand.md`. They count as styled, not "unstyled". Screens for later slices show an honest "Being built" card. Next step: mirror these into Figma frames and link them in the screen inventory.

**D-001 Cache Components off.** Next.js 16 enables `cacheComponents` by default. Nearly every screen reads the signed in user, so the request time model is simpler to audit. Revisit in Slice 10 if the static landing page needs partial prerendering.

**D-002 One display font.** Plus Jakarta Sans 600/700, Latin subset, self hosted via `next/font`, headings only. Body text uses the system font. Within the pack's "one subset web font at most". First load measured at about 220KB gzipped against the 300KB budget.

**D-003 OTP email kept in a cookie, not the URL.** Between "Email me a code" and "Enter your code" the address sits in a 10 minute httpOnly cookie, so it never lands in URLs, logs or analytics.

**D-004 Landing page events.** The pack's event list has no landing page events, but Slice 0 and Gate 1 require measuring the waitlist and price button. Added `waitlist_joined {source}` and `landing_price_clicked {product}`. Neither carries personal data. Waitlist emails go to an insert only `waitlist` table that the API can't read back.

**D-005 Local preview mode.** With no Supabase keys and `NODE_ENV` not production, the app shows sample data and the auth forms click through without a backend, with a visible banner. In production, missing keys return 503 from the proxy. Lets design review happen before the Supabase project exists.

**D-006 no_response moves.** "Can still move to any later status if the employer replies late" is read as: the same statuses a sent application can reach (rejected, assessment, interview, offer, withdrawn). Accepted still needs an offer first.

**D-007 CSP.** Baseline headers ship now (frame-ancestors none, object-src none, HSTS, nosniff, strict referrer, permissions policy with microphone for our origin only). Scripts still allow inline because Next needs a nonce for a strict policy; the nonce based CSP is a Slice 10 hardening item.

**D-008 Age gate.** The PRD blocks sign up under 18, but date of birth is a sensitive detail asked for only when a rule needs it. The consent screen asks for a required "I am 18 or older" tick and stores `users.age_confirmed_at`. No date of birth is collected at sign up.

**D-009 Sensitive details encryption.** Application layer AES-256-GCM with a random IV per value and the user id as additional data (a ciphertext moved to another user's row fails to decrypt). Keys are versioned (`SENSITIVE_DATA_KEY_V1`) for rotation. Chosen over pgsodium, which Supabase is phasing out.

**D-010 Column limits on users.** RLS lets a user update their own row; a column grant limits that to preferences (career stage, markets, low data mode, setup and age timestamps). Passes and usage counters are read only for users; only the service role (verified Paystack webhook) writes them.

**D-011 Target markets with "Both".** "Up to three countries" is read as three markets in total. Choosing Both makes Nigeria the first market and allows two countries abroad.

**D-012 Sample names.** Mock verdicts and sample data use fictional employers (Northbridge Bank, Lekki Foods), so marketing never implies a verdict about a real company.

**D-013 Rejected is grey.** Rejected, No response and Skip use neutral styling, never red. Red is reserved for scam flags and form errors (PRD voice principle 5, "no blame").

**D-014 Mobile nav labels.** "Applications" does not fit a 72px column at 12px on a 360px phone, so the bottom nav says "Applied" and "Check job". The desktop sidebar uses full labels.

**D-015 AI module rules the pack leaves open.** `lib/ai` is the only path to a model; `runTask(name, input)` returns validated data or a typed manual fallback, never raw text.
- Retries: one retry per call. Invalid output (schema failure, broken JSON, cut off at the token limit) retries with the problems attached. Timeouts, rate limits and 5xx retry without them. Refusals, "input too long" and other 4xx errors go straight to the manual step, because a second identical request would fail the same way. The SDK's own retries are off so a call never makes more than two requests.
- The retry is a fresh single turn request with a `<previous_attempt>` block listing schema paths and rules. The rejected output is never sent back, logged or returned.
- `timeoutMs` is per attempt, so the worst case is twice the task timeout.
- Delimiters: untrusted text sits in a tag named with a random 12 character code per request (`<untrusted_input_3f9a1c...>`), so a job post can't forge the closing tag. The ignore instructions rule lives in `prompts/_system/v1.md`, shared by every task. The log carries a hash of the full system prompt, so any wording change without a version bump still shows up.
- Structured outputs (`output_config.format`) built from the zod schema. The API can't enforce numeric or length bounds, so zod checks them after.
- No server side refusal fallback to another model. The pack fixes one model per task and the evals gate per model; a refusal goes to the manual step instead.
- Cost: one JSON log line per attempt with task, model, prompt version and hash, tokens, cost, latency and outcome. Prices are config (`config/ai_pricing.json`); Haiku cache rates use the standard multipliers until the price page lists them. `user_ref` is the same salted hash analytics uses, so cost per active user can be counted without an identifier. Persisting these lines, the weekly cost report and the budget alert arrive with the first real AI task (they need a table and a budget in config).
- Cache: tasks declare a key and TTL; the key is hashed with task, model, prompt version and prompt hash, and cached values are re-validated on read. No store is wired yet because no Slice 0 task needs one.
- Only a `smoke_test` stub task exists. Pack tasks arrive with their slices.

**D-016 Error tracking.** Sentry, errors only: no tracing, session replay, feedback widget or browser breadcrumbs.
- The browser uses a bare `@sentry/browser` client with five small integrations instead of the full `@sentry/nextjs` client. Measured cost: about 22KB compressed instead of about 75KB (largest page 200KB against the 300KB budget). The server and edge use `@sentry/nextjs` through `instrumentation.ts`.
- Personal data: `dataCollection` turns off user info, cookies, bodies, query strings, frame variables and AI inputs at source. `beforeSend` then masks emails and phone numbers in every text field, drops the user, request bodies, cookies, query strings and all headers except content type, accept and user agent. Tested in `tests/unit/sentry-scrub.test.ts`.
- No DSN means Sentry is off (local and preview mode). Use an EU hosted project. The DSN's host is added to the CSP `connect-src`.
- Source maps are generated and uploaded only when `SENTRY_AUTH_TOKEN` is set, then deleted so they are never served.
- `app/global-error.tsx` reports React render errors that never reach the window. No Figma frame: plain layout with tokens, logged as unstyled.

**D-017 CI.** GitHub Actions on Node 24 with three jobs: typecheck, Vitest, ESLint and copy lint; build plus a first load budget check (`npm run check:size`, gzipped JS and CSS plus preloaded fonts per page, HTML excluded because most pages render per request); evals. The evals job runs on every change, not only prompt changes, so it can be a required check. Until the golden sets exist `evals/run.ts` lists gates G1 to G5 and exits 0; a set with cases but no scorer fails the job so a half wired set can't pass silently.

## UI overhaul (12 Oct 2026, founder feedback round 2)

**D-018 Lufga font, demo files.** The founder chose Lufga with Urbanist as fallback. The supplied files are Fontspring DEMO files: the licence says purchase only, and they swap 30 characters (all symbols, the hyphen and the digit 4) for a "DEMO" watermark. The subset keeps letters and . , : ; ? only; Urbanist (one variable file) renders digits and symbols. Buy a Lufga web licence and replace `app/fonts/` before any public launch.

**D-019 Inactive buttons.** Primary buttons show a grey fill and muted text until the form is complete, using aria-disabled so the button stays focusable and a tap shows what is missing.

**D-020 Name-free brand.** "Receipts" is a placeholder. The mark is now a verified seal with a tick, the tagline is "Apply with proof." (config), and the torn edge class is `torn-edge`.

**D-021 Main action wording.** "Check a job" tested as unclear. The primary action is "Tailor my CV" everywhere, with the steps spelled out (add the job description, see if you qualify, get your CV and email). "Vault" shows as "My experience" in the interface; code keeps vault.

**D-022 Core flow preview.** Capture, job check, tailored CV and send pack screens are built. Capture saves pasted text and links for real; the check, CV and pack screens run on sample data in preview mode only and 404 elsewhere until Slices 3 to 6.

**D-023 Back office.** Founder asked for one. Built at `/admin`: overview against PRD targets and gates, users (masked emails), waitlist, payments with refund recording, truth reports with a 48 hour clock and the weekly CV sample, rules and lists with review then publish, AI cost and quality, audit log, team and roles.
- Access: an `admin_members` row (owner, reviewer, support, finance) plus TOTP two factor sign in (Supabase AAL2). Non staff get a 404. Role checks live in `lib/admin/permissions.ts` and are unit tested.
- Data goes through a service role client created per request after the guard, never sent to the browser. Every view of personal data and every change writes to `audit_log` with no personal data in `detail`.
- Refunds are made in the Paystack dashboard and recorded here (the pack says refunds are by hand in the MVP).
- New migration `0002_back_office.sql`: admin_members, truth_reports, ai_call_logs (mirrors `lib/ai/log.ts`), audit and rule review columns. Needs `SUPABASE_SECRET_KEY` on the server.
- Admin layout has no Figma frame: built from the design tokens with a Night sidebar.

## Slices 1 to 10 (12 Oct 2026)

**D-024 CV import keeps nothing.** An imported CV file is read in memory and never stored. Sensitive fields found in it (date of birth, gender, state of origin) are not saved from the import; the review screen only notes that they were seen. They are asked for later, at the point of use, with consent.

**D-025 CGPA scale.** When a CGPA is given without a scale, the eligibility engine assumes the 5 point scale used by most Nigerian universities and says so on the result; 4 point scales are recognised when stated.

**D-026 Shared caches.** The job parse cache and the legitimacy cache are shared across users by post hash (same post, same result), stored with the service role. They hold no personal data: only the parsed post and public lookups.

**D-027 Legitimacy search.** Structured outputs can't be combined with web search citations, so the lookup runs in two steps: a free text research step with the web search tool (Sonnet, up to 4 searches, config), then a Haiku step that structures it and may cite sources only by index into the real search results. Forums count as warnings, never proof.

**D-028 Link fetch.** Job links are fetched server side behind an SSRF guard: http(s) only, public IPs only (DNS checked, redirects re-checked), 5 redirects, 1.5MB, 10 seconds. A login wall falls back to paste or screenshot.

**D-029 Sharing the CV into Gmail.** A mailto link can't carry an attachment, so the email pack offers two routes: the Android share sheet with the CV PDF as a file (subject and message copied to the clipboard first, since not every app reads them from a share) and the mail app with subject and body filled, plus a download. Both routes still need the real phone test from the Slice 6 "done when".

**D-030 One application per job.** Opening the pack again after "I've sent it" shows the sent application instead of starting a second one. The send pack checks the employer address and link from the post: a plain address only (no smuggled ?bcc=) and web links only.

**D-031 Paste to classify.** classify_outcome suggests; code checks the quoted line is really in the message; the person confirms before anything changes. A status set this way is marked verified only when the quote was found. Messages that ask for payment get a warning. We store the quote, not the whole message.

**D-032 Check ins.** In app only (home card and header bell). The pack mentions push or WhatsApp reminders at most once a week; no provider is chosen, so none are sent yet. "No reply yet" schedules the next check in with a 7 day floor. A daily cron (`/api/cron/outcomes`, `CRON_SECRET`) marks No reply after 30 days through a service role only database function.

**D-033 Shortlist mode access.** Shortlist mode is part of the trial and the pass. Without either, the Interview boost (config price) unlocks it for one application: the boost pass row points at the application. Questions that don't link to a line in the CV sent are dropped; if fewer than 3 remain we fall back to "walk me through this line" questions. The drill checks numbers and years in the answer against the CV line in code before the model's feedback is added. Stronger answers are points, never a script.

**D-034 Debrief question bank.** Debrief questions are kept on the person's record. They are only marked shareable with the question bank consent, which can be withdrawn in Settings (that also unmarks past debriefs). No shared bank screen exists yet.

**D-035 Payments.** Start: a pending pass with an unguessable reference (created with the service role, since users can't write passes), then Paystack. Only the webhook unlocks: signature over the raw body, one row per (reference, event) in `payment_events`, a direct verify call, then `activate_pass`, which activates a pending pass with the exact amount at most once. A new 30 day pass bought before the old one ends starts when it ends. The callback page only shows the state and refreshes while pending. `APP_URL` fixes the callback address in production.

**D-036 CSP nonce.** Closes D-007. `proxy.ts` sets a fresh nonce per request with `'strict-dynamic'`; every page renders per request (`connection()` in the root layout) so it can carry the nonce. Inline style attributes stay allowed for animation delays and CSS variables. Webhook and cron routes skip the proxy.

**D-037 Data rights.** Settings has personal details, data saver (system fonts, no motion), sensitive details (see which are saved, delete one or all), consents (withdrawing sensitive details deletes them), a JSON export of every row we hold (sensitive details decrypted only when ticked for that export) and account deletion (storage files first, then the sign in record; the cascade removes every row). Migration 0008 changes three RESTRICT keys to NO ACTION so the cascade can complete. Payment rows go with the account; Paystack keeps its own records.

**D-038 Offline records.** The service worker keeps the applications list and each application page (job snapshot and the CV sent) for offline reading, up to 40 pages, on this phone only. Signing out deletes them. Pages are network first, so they're never stale while online.

**Unstyled screens (no Figma frames yet):** applications list and detail, send pack, debrief, Shortlist mode and drill, paywall, payment result, all Settings sub screens. Built from the design tokens.

## Founder feedback round 3 (12 Oct 2026)

**D-039 Home order.** Overview numbers first, then "Heard back yet?", then the Tailor card, then recent applications. Spacing tightened to 16px between sections and 12px inside grids. Card radius tokens lowered: cards 20 to 14px, panels and the hero 28 to 20px (`app/globals.css`, `design/tokens.json`). On phones the overview cards stack icon, label and number so labels never truncate.

**D-040 Check in window.** "Heard back yet?" shows only applications sent in the last 30 days that are due a check in, and disappears when there are none. Applications past 30 days are closed to No reply on read (as well as by the daily job), so the card never shows stale ones. A No reply application opens with "Heard back late?": one tap for "I got invited" (opens interview prep), "Invited to a test", or paste their message. The applications list explains this on the Closed filter.

**D-041 Tailor my CV as a modal.** Every "Tailor my CV" link opens the capture form over the current page through an intercepting route (`app/(app)/@modal/(.)jobs/new`). It is a bottom sheet on phones and a centred dialog from 640px, built on the native dialog element (focus trap, Escape and backdrop close, which go back). A refresh, a shared link or the Android share target still opens the full page at `/jobs/new`. A catch all slot route closes the modal on any other navigation.

**D-042 Sidebar active item.** Matched to the founder's reference: an inset pill with all corners rounded, a flat soft periwinkle wash, and a navy bar as the pill's left edge (the clipped corners give it the curve). Icon and label turn navy; the icon stays in its outline style. Inactive labels stay ink-500 rather than the lighter grey in the reference, to keep 4.5:1 contrast.

**D-043 Count up fallback.** Animation frames pause in background tabs, which left stat numbers part counted. The final number is now set by a timer after the animation's length.

## Founder feedback round 4 (12 Oct 2026)

**D-044 Tighter layout.** Sidebar 248px (88px collapsed) with the collapse control always beside the logo. Top bar 76px. Content uses the same 24px side padding as the top bar and no max width, so its right edge lines up with the name in the top bar; the name's dropdown arrow is gone (it was a link, not a menu). Home sections and grids sit 12px apart. Settings fills the width in two columns from 1280px, with a full width Sign out.

**D-045 Sidebar holds places only.** "Tailor my CV" left the sidebar: it is the top bar's main button on wide screens and stays in the centre of the phone bar, where there is no top bar button.

**D-046 Overview cards and check in card.** Overview cards follow the founder's sketch: label on top, icon bottom left, number and hint bottom right. The check in card has no visible title or bell; a screen reader heading stays, and the lead line reads "Any news on these applications? Tap one answer for each." Each item shows the role, employer and date sent. "Our promise to you" is an itemised list and stretches to the height of Recent applications.

**D-047 Modal header.** The close button sits on its own row above the title, square with an 8px radius. The modal is up to 896px wide from 640px.

**D-048 Plain words pass.** For Nigerian readers and readers abroad: Interview prep (not Shortlist mode), interview notes (not debrief), saved job post (not snapshot), check if you qualify (not eligibility), must haves (not hard requirements), Join the waiting list (not an idiom). Code names stay. Terms added to design/voice.md.

## Founder feedback round 5 (12 Oct 2026)

**D-049 Voice in preview.** Voice answers appear wherever a speech provider is set. Until the G4 benchmark picks one, they now also appear in local preview mode, where the transcribe endpoint returns a sample transcript, so the flow can be reviewed. In production without a provider the voice option stays hidden and typing is the only way.

**D-050 Updates panel.** The bell in the top bar opens a panel from the right (native dialog, Escape and backdrop close, square close button) listing applications sent in the last 30 days that need an update, each answerable in one tap. It closes on any page change. Answers refresh every page's layout.

**D-051 My experience modals.** Upload a CV, Answer a few questions and Add a role by hand open over the page through intercepting routes, like Tailor my CV. A refresh or shared link still opens the full page. The three action cards now carry a hint line; "Talk or type" makes the voice option visible before opening.

**D-052 All in one SQL.** `npm run sql:bundle` builds `supabase/sql/app_schema.sql` and `supabase/sql/back_office.sql` from the numbered migrations, which stay the source of truth. The bundles are for a brand new project only.

**D-053 Applications header.** The page header has no Tailor my CV button: the top bar has it. The empty state keeps its own button, as it is the only next step there.

## Founder feedback round 6 (13 Oct 2026)

**D-054 Two baseline migrations.** The founder ran the two all in one files on the live project, so they became the migrations: `20261013000000_app_schema.sql` and `20261013000100_back_office.sql`, byte for byte the same SQL as the old 0001 to 0008 (checked by rebuilding before the swap). The numbered files, `verify_setup.sql`, the bundles and `sql:bundle` are gone. New changes are new dated files.

**D-055 Updates panel is the inbox.** The bell opens Updates: "Needs your answer" (check ins) on top, then "Latest": messages from the team, a message to one person, payment receipts, pass ending and ended, trial ending. Opening it marks everything seen; the badge counts check ins plus unseen items. Personal notifications are written only by the service role (webhook, daily job, back office) with a dedupe key; people can read theirs and set read_at, nothing else. Links must be paths inside the app. The "See all applications" link left the panel.

**D-056 Back office messages.** New "Messages to users" page (owner and support): send to everyone, people on the trial, pass holders, people without a pass, or one person by email; optional in app link and show-for days; preview of what people see; end a message early. Sends are audit logged without the text.

**D-057 Modal slot fix.** The catch all page in the `@modal` slot (D-041) made every page outside the `(app)` group unreachable in Next 16: sign in, onboarding, legal, offline and the back office returned 404 ("page files do not match any complete route"). It is removed; the modal now hides itself when the address changes. CI's build step would have caught it; the build passes again.

**D-058 Research review.** A product and UX research review with ranked bets is published as an artifact (Receipts Retention Playbook). Its figures are hypotheses for the research plan, not measured results.

## Founder feedback round 7 (13 Oct 2026)

**D-059 Check ins live in the Updates panel only.** The home card is gone; the bell is the one place to answer them.

**D-060 One modal header.** `components/ui/modal-header.tsx` gives every modal, sheet and panel the same header: a square close button (8px radius, bordered) on its own row, then the title and description. A file picker's "cancel" event bubbles to the dialog; the route modal now closes only on its own Escape, so cancelling the picker keeps the modal open.

**D-061 Uploads up to 10MB.** The host caps request bodies near 4.5MB, so files over 4MB go straight from the browser to the person's own `incoming/` folder in the private `job-uploads` bucket through a one time signed URL; the server reads each file once and deletes it. That also applies to CV import: the CV file is held only for the seconds it takes to read, then deleted, so D-024 still holds in substance. Too big files get a plain message with the actual size. Migration `20261013000300_uploads_10mb.sql` raises the bucket limit and allows Word and text files.

**D-062 Standard CV layout.** PDF and Word now follow a standard professional layout: name in letter spaced capitals, the title line, contact details separated by bars, a rule; Profile summary; role title and dates on one line with employer and location in italics below; hanging bullets; Education, NYSC and Certifications as structured entries (title and dates, institution, class of degree); skills with bold labels; Referees; "Name · CV · Page x of n" footer. A new `entries` section kind carries the structure; older saved CVs with plain lines still render.

**D-063 Settings layout.** The profile card has an Edit details button (to the personal details screen) and the separate row is gone. Section headings are gone; the two cards are "your job search and plan" (where you're applying, data saver, pass and payments) and "privacy and your data". The data saver row highlights as one piece, icon included.

**D-064 Motion.** Every page eases in (template), the bell rings once when something new is waiting, progress segments fill in turn, overview cards are links that lift with a small icon tilt, arrows nudge on hover, lists stagger in. All of it stops with reduced motion and with data saver.

**D-065 Preview server.** `npm run dev:preview` (port 3001, its own build folder) forces sample data even when real keys are in `.env.local`, so design reviews never need a sign in. It can never switch on in production.

## Founder feedback round 8 (13 Oct 2026)

**D-066 Centred sign in panel.** The blue panel on sign in, consent and setup centres its logo, heading and steps horizontally; the two floating proof cards sit one on each side so the centre stays clear.

**D-067 AI budget mode.** `AI_BUDGET_MODE=haiku` runs every AI task, including the job research step (capped at 2 searches), on Claude Haiku, for testing on a small budget. Leave it empty in production: quality gates are measured on the models each task names. Switching to another provider's free tier was considered and not done: free tiers commonly allow the provider to use prompts to improve their products, and prompts here contain people's CVs.

## Founder feedback round 9 (13 Oct 2026)

**D-068 Gemini first, Claude second.** Founder decision: every AI task runs through a provider chain (`lib/ai/chain.ts`), Gemini first and Claude second, so the app can be tested on Gemini's free tier until there are funds for Claude. Order is set by `AI_PROVIDERS` (default `gemini,anthropic`); a provider without a key is skipped, and a failed call falls through to the next one. Gemini uses JSON mode with the task's schema written into the system text, so the zod check and one retry in `runTask` still apply; web research uses Google Search grounding and takes sources only from the grounding metadata. The free tier logs a cost of zero (`GEMINI_TIER=paid` restores real costs). This supersedes the "not done" part of D-067. Known trade off, accepted by the founder for testing: Google's free tier may use prompts to improve its products, so the go live guide says to test with the founder's own or made up CVs. Before real users, add the Claude key and set `AI_PROVIDERS=anthropic,gemini`, or move Gemini to the paid tier. Evals must be re-run on whichever model goes first.

**D-069 Sign in link fallback.** New free Supabase projects lock the email templates until custom SMTP is on, so the 6 digit code can't be added yet. Every sign in email now also carries a link (`/auth/callback?method=email`) that signs the person in, and the screens say "code or sign in link". When custom SMTP is on, the founder adds `{{ .Token }}` to the template and both work.

**D-070 Free access for family and testers.** The back office (Payments, needs the payments permission) can give an email free access for 30, 90 or 365 days or with no end date. A `free_access` table holds one live grant per lowercased email; users can read only their own row (matched on the email in their sign in token) and never write. The viewer treats a live grant as a pass of type `free_access`, so every entitlement check works unchanged and no fake payment is recorded. Granting and removing are audit logged.

**D-071 Applications sent with a CV made elsewhere.** "Add one you already sent" saves the job (post or link, optional), the exact PDF or Word file the person sent (private `cv-exports` bucket), the date and the channel. The application is marked `source = logged`, starts at Sent, and gets check ins and interview prep like any other. The file opens only through a short lived signed link for its owner. Questions from the CV can't be linked to vault lines for these, so prep leans on web questions and the job post.

**D-072 Interview questions from the web.** Interview prep can search the web for questions people report from real interviews for this employer or this kind of role. Same two step pattern as the scam check: a search step, then a structuring step that can only cite sources by number from the list the search returned, so no link is invented. Each question shows its source. Saved on the Shortlist session (`web_questions`).

**D-073 Data saver fix.** The toggle silently failed: the update wrote `updated_at`, which is not in the column grant users have, so the whole update was refused. `updated_at` is set by the trigger, so it's removed from the update. The switch now waits for the save, flips back if it fails, and applies at once. With data saver on, a "Data saver on" chip shows in the header and decorative previews hide.

**D-074 Date fields.** Month and year are picked with two dropdowns (Month, Year) instead of the browser's calendar, which made jumping to a year years back slow. Date of birth uses day, month and year dropdowns. The value sent is unchanged (YYYY-MM or YYYY-MM-DD). The "day you sent it" field keeps the calendar: it is almost always a recent date.

**D-075 Adding a role.** Type labels say what they mean: "Work experience", "NYSC", "Professional certificate". When adding a role that has work in it, a "What did you do there?" builder takes one thing at a time; each becomes a confirmed vault item owned as "did". The modal closes as soon as the role is saved. Adding achievements keeps the form open and says "Added 2. Add the next one, or tap Done."

**D-076 Personal details.** Phone has a country code picker (Nigeria +234 first, list in `config/lists/phone_codes.json`) and is stored as "+234 8030000000" with the leading 0 dropped. Portfolio and website are optional and appear in the CV contact line. Save stays disabled until something changes. The first CV import fills empty personal details only; it never overwrites what the person typed.

**D-077 Home steps in order.** Step 2 and step 3 stay locked, with "Opens after step N", until the step before is done.

**D-078 Skip verdict still builds.** When the check says skip, the page now also offers "Build my closest CV anyway" (the existing override, now visible), with an honest note that the CV can only use what is in their experience. Hard filters are still decided by code and still shown.

**D-079 Sign in panel, take two.** D-066 is reverted: the panel's content is left aligned again. The whole blue panel is now vertically centred with space above and below, wider (about 56% of the screen), and the badge reads "For anyone looking for their next job" (the old badge said it was only for NYSC members and new graduates, which isn't true). The floating cards stay one on each side.

**D-080 Settings on phones.** The initials circle is hidden under 640px so the name and email have room, and "Edit details" is an edit icon in the card's top right corner.

## Founder feedback round 10 (13 Oct 2026)

**D-081 Every tap answers at once.** Pages render on the server per request, so a tapped link used to show nothing until the next page arrived. Now: a thin bar runs across the top from the tap until the next page is on screen (and the cursor shows busy); skeleton screens (`loading.tsx` in the app and the back office) show the shape of the next page straight away; every server form button (Remove, Confirm, Publish, check in answers, Tailor my CV, Sign out) shows a spinner and a "Saving" style label and ignores double taps (`components/ui/pending-button.tsx`). Spinners keep turning with data saver and reduced motion, because they mean "working", not decoration.

**D-082 Full time, part time or contract.** Work experience and internships have a second dropdown beside the role kind. Only part time and contract print on the CV, as "Accounts Officer (Contract)" or "(Part-time)": a short contract on a CV otherwise raises questions about why it ended. Full time is the default and is stored as empty. The CV parser (prompt v3) fills it only when the CV says so. It is the user's own fact, like the title, so the fact lock doesn't treat it as a claim. Roles save without it until the migration runs.

**D-083 A way out of every add mode.** Adding achievements has a close button, a Cancel (Done after one is added) and Escape. Editing a role inline has Cancel.

**D-084 Small layout fixes.** Settings: on tablets and laptops the profile card has an "Edit details" button; phones keep the corner icon. The sidebar collapse control is a 36px circle with two clearly separated chevrons. The sign in panel is now nearly full height with a strip of white above and below.

**D-085 Where you apply: a region, not a country list.** Setup asks Nigeria, Abroad or Both, and never lists countries: people apply to countries we could never list, and each job post tells us its country. `target_markets` stores `NG` and `INTL` (abroad). Older country lists read as a region. Destination detection ignores `INTL`; with no country signal in a post, abroad only users get the UK style international format with a note to change it, everyone else gets Nigeria. Opening setup from Settings shows the current answers and returns to Settings.

**D-086 Back office sign in page.** Signed out visits to `/admin` now go to `/admin/sign-in`, a staff sign in page (email code or link, or Google) that lands on `/admin`, which then asks for the authenticator code. This replaces the plain 404 for signed out visitors (founder's request: the 404 made the back office look missing). Signed in people who aren't on the team still get a 404. Staff can sign out from the back office header, back to its sign in page. Not indexed by search engines.

**D-087 Managing users.** New permission `users.manage`, owner only: full emails (users, payments, waitlist), pausing and deleting accounts, and contact details on a person's page. Everyone else with `users` still sees masked emails. The Users page shows plan (pass, free access, trial), total paid, active days in the last 30, last active, and filters (pass now, have paid, active this week, paused). A person's page shows a 30 day visit chart, counts of what they've done (never CV text, job posts or sensitive details), payments, and the controls. Pausing sets `users.suspended_at` and bans the sign in record; the app sends them to a "paused" page at once. Deleting needs the person's email typed exactly, removes their files, then the sign in record (the cascade removes every row). Team members can't be paused or deleted until they're removed from the team. Every view and action is audit logged without emails. Usage comes from `user_activity`: one row per person per day (Lagos time) with a visit count, written after the page is sent; no pages, content or devices are stored.

**D-088 Back office sidebar never scrolls.** It is fixed to the screen, sized so all sections fit a 640px tall laptop screen; on short screens the "Staff only" note hides first.

**D-089 Gemini busy fallback.** Google's free tier often answers 503 "high demand" for its newest model. Each call now tries the next Gemini model (`GEMINI_FALLBACK_MODELS`, default gemini-3.5-flash then gemini-3.5-flash-lite) on 429, 5xx or a retired model name, before falling through to Claude.

**D-090 Account deletion covers sub folders.** Deleting an account (by the user or the owner) now removes files in sub folders too (`incoming/`, `sent/`). Before, only top level files were removed.

## Founder feedback round 11 (13 Oct 2026)

**D-091 Modals open over a still page.** The app wide skeleton screen from D-081 (`app/(app)/loading.tsx`) made Next re-draw the page underneath every time a modal opened (Tailor my CV, Add a role, Upload your CV), so the page flashed and eased in again before the modal appeared. It is removed. Instead each modal route has its own `loading.tsx` that opens the modal frame at once, with its title and a placeholder, and the form fills in; the filled modal replaces the frame without a second pop. Modal links don't run the top bar. The top bar and busy buttons from D-081 stay; the back office keeps its skeleton (it has no modals).

**D-092 Back office sign in reverted.** D-086 is undone at the founder's request: no separate back office sign in page. Signed out visits to `/admin` go to the normal sign in page as before; the only change is that it returns to `/admin` afterwards (`/sign-in?to=admin`, a fixed value, never a caller supplied URL). Signed in accounts not on the team still get a plain 404. The 404 the founder saw was a second Google account that isn't on the team.

**D-093 Users list and country of use.** A whole row opens the person, not only the arrow. "Lives in" is removed from a person's details. "Using the app from" shows the country of their latest visit, from the host's IP lookup (`x-vercel-ip-country` on Vercel). Only the two letter country code is stored, per day, in `user_activity`; no IP address or city. Locally it reads "Not known yet".

**D-094 Audit log shows what staff did.** Each entry says who (name, email and role), what in plain words ("Paused an account", "Gave free access") and to whom (the account's email, a payment reference or a rules version). Views of personal data are still recorded, because the Build pack requires it, but they sit under their own "Views of personal data" tab, as do two factor sign ins; the default tab is Actions.

**D-095 Team and access controls.** Each team member can be paused (no back office access until reactivated), reactivated, or deleted from the team (their app account stays). Nobody can change their own access, and the last active owner can't be paused or deleted. `admin_members.paused_at` is new; reads use "*" so the back office still opens before the migration runs.

**D-096 Back office headings and spacing.** Page, panel and column headings use Title Case with short joining words kept small (and, of, or, the, plus a, an, to, in, on, for, by, at), and so do the menu and tab titles. Gaps between blocks went from 24px to 16px and table rows are tighter. The empty space under long pages came from the chart's screen reader table: a table ignores the 1px "visually hidden" size, so it stretched the page; it now sits in a hidden wrapper.

**D-097 AI calls are logged for the back office.** Every model call now also writes a row to `ai_call_logs` (task, model, outcome, tokens, cost, time; never prompt or answer text). AI Cost and Quality shows which AI keys this server has, in the order they're tried, and the latest failed calls, so a failing CV upload can be traced to a missing key on Vercel in one look.

## Founder feedback round 12 (14 Oct 2026)

**D-098 Faster AI.** Measured on 14 Oct 2026 with the founder's free Gemini key: gemini-3.8-flash took up to 90 seconds for a two line answer, gemini-3.5-flash about 2 seconds with thinking off. The default strong model is now gemini-3.5-flash (`GEMINI_MODEL` still overrides). Thinking follows each task's effort: low effort tasks skip it, medium ones think briefly, lite models choose their own. A busy or retired model hands over to the next Gemini model within the same time budget.

**D-099 Reading links like ChatGPT does.** Many job sites (LinkedIn and others) block apps like ours. When our own fetch is blocked or needs a login, Google opens the page for us (Gemini url_context) or searches for a public copy of the same post (google_search). The text is only used when Google actually retrieved the page or returned sources, so nothing is made up; it is untrusted job post text like a paste, and the person still checks the details on the next screen. The same reading works for "Add one you already sent".

**D-100 Voice through Gemini.** The founder couldn't find a microphone because no speech provider was set, so voice was off in production. Gemini now writes down recordings (tested with a browser webm recording: exact, including "Lekki Foods" from the vocabulary hint). `SPEECH_PROVIDER=off` turns it off; the G4 benchmark still decides the long term provider. Audio is sent in the request and never stored by us. A small "Say it instead" control now sits by every achievement box (adding a role, adding an achievement) and in interview practice, and what was said lands in the box to edit before saving or checking.

**D-101 /vault is now /experience.** The address matches the name people see. Old links redirect permanently.

**D-102 Experience folds.** Each role is folded to its header (title, employer, dates, badges, achievement count) with a chevron; a tap anywhere on the text opens it. Roles that still need a check open by themselves.

**D-103 The review page never jumps.** After importing a CV, every role stays on the page in the same order while people confirm; before, a confirmed role disappeared and the page moved under their finger.

**D-104 Home step 2 is done only after a CV.** "Tailor your CV to a job" counts as done once a CV has been tailored, not when a job is added. Setup shows until the first application is sent. The fourth Home card is "Work experience": the number of places worked or served, with confirmed achievements as the hint.

**D-105 A tailored CV makes an application.** When a CV is ready, the job appears under Applications as "Not sent yet" with that CV. Applications stays highlighted in the menu through every tailoring step, and each step has a back link to the one before.

**D-106 Honest waiting.** Slow AI steps (reading a CV, reading a job, the fit check, writing the CV) show one coloured panel: what is happening now, a running clock, a real range ("Usually 10 to 40 seconds") and, after a minute, "Still working". The old "about 20 seconds" promise is gone.

**D-107 Logging an application needs the job and the CV.** "Save this application" stays inactive until there is a job post or link and the CV file that was sent; the line above the button says what's missing. Title and employer are read from the job and can be typed to override.

**D-108 Deleting an application.** People can delete an application from its page (record, check ins, prep and the logged CV file). The back office keeps only a per person count of deleted applications.

**D-109 Interview prep questions.** "Tell me about yourself" is always first. Then at least ten questions: lines from the CV they sent to defend, and the questions commonly asked in that field for that level, from the model and topped up from `config/lists/interview_questions.json`. General questions are checked against the strongest lines of their CV. Every question can be answered by voice or typing, and the transcript is editable before the check.

**D-110 Visits mean sessions.** A visit is counted when someone opens the app, and again only after 30 minutes away (a small beacon, not page loads), so moving between pages or refreshing never adds visits. The country comes with it (D-093).

**D-111 No waitlist.** The landing page price button records an anonymous tap (a random id kept in that browser, no IP, no account) as willingness to pay, then goes to sign in; signed in people go to the pass page. The waitlist section and its back office menu item are gone; the table stays for history.

**D-112 Is this job real, as a checklist.** The scam check now answers in order: does the company exist (and its official website), how long it has been around (founded year from a cited source), are the email and apply link on the company's own domain (Gmail for a big company is a warning), did the company post the job itself (its careers page or its LinkedIn page), any public warnings, are the contacts in scam reports. Each line says passed, failed or "Couldn't check" with the reason. The company's own domain found by the search decides the domain check when the post doesn't claim one. Still never "safe".

**D-113 A separate "Is this job real?" check.** `/jobs/real` runs only the scam check on a pasted post, link or screenshot, free for everyone, with a button from Home and from the tailoring screen. The result offers "Tailor my CV to this job".

**D-114 Pricing: a bundle with an allowance, not points.** Founder asked whether to sell points so heavy use doesn't cost more than it earns. Recommendation, built: keep the one simple pass, but say what it includes in user terms, the way data bundles work in Nigeria (amount plus validity). The ₦5,000 pass includes 30 tailored CVs over 30 days (the step that costs money); a CV top-up adds 10 more for ₦1,500 and lasts until the pass ends. Everything else stays free (experience, job checks including "Is this job real?", tracking). Abstract points were not used: people can't tell what a point buys, they hoard them, and a CV tool should be used, not rationed. The numbers are in `config/prices.json` for the founder to confirm. CVs used are counted from `cv_versions` since the current pass started, so no new counter is needed.

**D-115 Back office numbers explained.** Overview cards use the same design as the app's Home. Every key number has "How it's counted", and the numbers are now computed from real data: price taps, experience ready on day one, first pack within 24 hours, trial to pass, invites per active seeker, AI cost per active user, flagged lines resolved, applications sent.

**D-116 Title Case headings in the app.** Page and section headings, modal titles, menu items and browser tabs in the app use Title Case (design/voice.md rule 13). Buttons, labels and body text stay in sentence case.

**D-117 Reading job links from the boards themselves.** Founder round 13: links still failed. Two causes. The Moniepoint Greenhouse post had been taken down, so the link redirected to the company's job list and the parser rightly said "not a job advert"; the message now says the job has probably closed. And Google's search tool (used to read blocked sites) returns "quota exhausted" on the free Gemini key. Links from LinkedIn, Greenhouse, Lever, Ashby, Workable and SmartRecruiters are now read through each board's own public, no login feed for one post (LinkedIn's guest job page, the boards' posting APIs), at fixed hosts, so no user URL is fetched blindly. A board that says the post is gone gives a clear "closed" message. Other sites: our own fetch (browser user agent), then Gemini opening the page (works on the free tier), then Gemini search (needs search quota). Text from any of these is untrusted job post data, like a paste.

**D-118 Scam check answers without web search.** Every line said "Couldn't check" for Moniepoint because the web search failed (free tier quota) and the empty result was cached for 7 days. Now: the company record comes from Wikidata (the open data behind Wikipedia: exists, official website, year founded), a post on the company's own Greenhouse, Lever, Ashby, Workable or SmartRecruiters board counts as posted by the company and its apply link as the company's own, and the website's age from RDAP stands in for the company's age when no founding year is found. Web search adds warnings and scam reports when it works. A check whose search failed is kept 15 minutes, not 7 days, says so, and offers "Check again"; old cached checks without the company line are run again. A real company name in a fake post still passes "The company exists": the other lines (email domain, who posted it) catch that, as they did for a test with a Dangote name and a Gmail address.

**D-119 My Experience: order, folding and adding.** Achievements in a role can be moved up and down (arrow buttons, not dragging: they work by touch and keyboard, and on low end phones); the order is stored per achievement (`vault_items.position`) and the CV writer gets them in that order. New achievements go to the top, and "Add an achievement" sits above the list. Education, certificates and licences have no achievements, so their cards no longer fold; each section (Work and Experience, Education, Certifications and Licences) folds instead. Cards sit at the top of their grid row, so opening one never stretches the one beside it.

**D-120 Confirm windows for deleting.** Deleting an application or removing a role asks in a small window (native dialog, "Keep it" focused first), not inline. Delete application moved to the top right of the application, as a visible red tinted button.

**D-121 Toasts.** One notice area, centred at the top, for "done" messages: saved, confirmed, removed, deleted, sent, recalled, copied, status updated. Server actions leave the notice in a 30 second cookie that the page reads once; client code calls toast(). It shows above open modals (top layer popover), closes itself after 4 seconds (6 for errors) and is announced to screen readers.

**D-122 Saved jobs show under Applications.** "Save for later" on the job check now lands on Applications > Saved for later, and saved jobs show in All with a "Saved for later" badge. They open the job check, where the person can tailor a CV or skip.

**D-123 Back office message history, drafts and recall.** Messages to one person were stored only in that person's Updates panel, so the back office never showed them. Every message now goes into a history (admin_messages) with who sent it, to whom (email masked unless the role can see full emails), when, and whether it's showing, delivered or read. Messages sent before this show too, from the announcements and the Updates panels. "Save as draft" keeps a message to finish later; "Recall" ends a group update at once or takes a message out of the person's Updates panel, and marks it recalled.

**D-124 Download my CV from My Experience.** A general CV written by the same writer and fact lock as a tailored CV, aimed at the person's own field (their latest job title) instead of one advert, as PDF or Word. It doesn't use a tailored CV from the trial or the pass (founder can change this), and it's written again only when confirmed experience changes, otherwise the same file comes back, so repeated taps cost nothing. Rate limited with tailoring.

**D-125 Voice answers tidied before they land.** When someone says an achievement, the words are written up as one clear line (polish_achievement v1) before they appear in the box. Code checks the line adds no number that wasn't said (spoken number words count) and no banned phrase; otherwise their own words are used. The box says it was written up, with "Use my exact words" to switch back, and what they actually said is saved as the achievement's source. They read and save it themselves, so nothing reaches a CV unseen.

**D-126 Lighter placeholders and small "you".** Placeholder text uses a lighter grey (ink-350) so empty fields never look filled. In Title Case headings, "you" and "your" stay small after the first word ("Tailor your CV to a Job"), the founder's rule. The "To save, add..." hint on Add one you already sent is gone; the button stays inactive until the job and CV are added.

**D-127 The back office has its own sign in.** Founder round 14 (reversing D-091's "use the app's sign in"): the back office signs in at /admin/sign-in, a dark staff only screen, separate from the app's. It uses the same accounts, so there's no friction between the two: a team member signed in to either is signed in to both, goes straight in, and never sees the app's onboarding. Signed out visits to /admin go there. Someone signed in with an account that isn't on the team sees which account they used and can switch to their team account. The page shows that a back office exists; access still needs a team account and two factor sign in, every action is logged, and admin pages are never indexed or cached.

**D-128 CV downloads come straight back.** The download replaced its stored copy with an "upsert", which Supabase storage only allows with an update rule, and there wasn't one, so every download failed with "We couldn't prepare your file". The file is now sent in the response; the private copy for the application's record is stored as well, and if that fails the download still works. The migration adds the missing update rule (section 14).

**D-129 Job post as a photo or PDF on "Add one you already sent".** The job can be pasted, linked, or added as a screenshot, photo, PDF or Word file, read the same way as for tailoring.

**D-130 Remove a saved job.** Saved jobs can be removed from the Applications list (bin icon on the row) or from the job's check page, with one confirm. Only jobs without an application: a sent one belongs to the person's record.

**D-131 Reorder mode and independent columns.** The always-on arrows made every achievement row busy. Achievements now show clean; a "Reorder" button opens reorder mode, where each line gets a drag handle (mouse) and up and down buttons (touch and keyboard), with "Save order" and "Cancel". On wide screens the role cards sit in two independent columns, so opening a card on the right never moves the left.

**D-132 Picking the person in back office messages.** Typing a name or email in "One person" lists matching people (from 2 characters, at most 8); picking one sends to that account by id, so a typo can't reach the wrong person. Full emails only for roles that can see them, masked for others. "No account uses that email" now shows under the field, which keeps what was typed and turns red. The history shows each message's text.

**D-133 Browser extension.** A small Chrome extension (extension/) sends the job advert open in the browser to Receipts: "Tailor my CV to this job" or "Is this job real?". It reads the page only when tapped (activeTab), copies the advert's text and address, and opens Receipts with them after the "#" in the link, which never reaches a server; the app reads them once and clears the address bar. Because it reads the page the person can already see, it works on LinkedIn pages behind a sign in. Everything is saved to their account, so it shows on their phone too. Not on the out of scope list. Chrome on Android doesn't run extensions; on phones, sharing a job to the installed app (already built) does the same job.

**D-134 Security review.** Checked every API route and server action for the signed in user check and user id filter, row level security on every table, storage folder rules, the webhook signature, CSP and headers, the SSRF guard, secrets and dependencies. Changes: the storage update rule (D-128), admin pages sent with no-index and no-store headers, wildcard escaping in the back office search, and CI fails on high or critical vulnerabilities in shipped packages. SECURITY.md has the architecture, the controls, the findings, and what the founder must switch on outside the code.

**D-135 Name recommendation.** Founder asked for a brandable, international name with a free domain. Recommended: Prova (Italian and Portuguese for "proof", the root of prove and approve; two syllables; easy to say and spell; not tied to one country). On 14 Oct 2026 the registries showed provacv.com, provacv.app, useprova.app, tryprova.app and prova.careers unregistered; prova.com and prova.app are taken. No CV or job app called Prova turned up in a web search. Needs a trademark search (Nigeria, UK, US, EU, class 9, 35 and 42) before buying. Not changed in the app yet: the name lives in config/app.json.

**D-136 The back office is a separate app, with its own session.** Founder round 15, replacing D-127's shared session: the back office now keeps its own sign in session in its own cookie (`rcpt-admin-auth`), sent only to /admin pages, with its own callback (/admin/auth/callback). Signing in to the back office doesn't sign anyone in to the app, signing out of one leaves the other alone (local sign out), and the back office never creates accounts from an email code. Same account system underneath: a team member is an existing account added in Team and Access, and two factor sign in is asked for in the back office session. "Back to the App" and the links between the two sign in pages are gone. Supabase needs /admin/auth/callback in its redirect list.

**D-137 A winning general CV, written fresh every time.** "Download my CV" now runs two AI steps each time: cv_target v1 reads the confirmed experience and picks the standard job title, industry, level and 12 to 18 keywords recruiters and applicant tracking systems in that field search for; the CV writer then writes for that field at that level, using the keywords the evidence supports, with the same fact lock as tailored CVs. No more "same CV as last time". If the AI can't write it, the person is told and can try again; they never get an unwritten copy of their notes. The file is named for the target role.

**D-138 Extension in the app, Get help in the top bar.** A "Chrome extension" page (/extension) explains it and lets people download and add it free (Developer mode, Load unpacked) until it's in the Chrome Web Store; set `chrome_extension_store_url` in config/app.json once it is, and the page shows "Add to Chrome" instead. It's linked at the bottom of the sidebar on laptops and in Settings. Get help moved out of the sidebar to a round button beside the bell.

**D-139 Back office search fix.** The "One person" search asked the users table for a full_name column that lives on profiles, so every search failed and showed "No one matches". Names come from profiles now; the same bug hid names in the message history.

**D-140 Name recommendation, round 2.** Founder found Prova CV hard to say. Checked about 300 names against the .com, .app and .io registries and the hiring market: nearly every short, catchy name is registered, and many are already hiring products (Landed, HireJoy, Vetta, CredoHire, Joblynn, Vouch, Shortlist, Callback). "Proud" names were dropped because in careers they read as LGBTQ+ employer branding. Recommended: Trail (one syllable, said the same in every accent, spelled as heard; a paper trail is proof, and a career is a trail). trailcv.com, trailcv.app, trailcv.io and trail.careers were unregistered on 14 Oct 2026, and no CV or job product called Trail turned up. Needs a trademark search before buying. Not changed in the app yet.

**D-141 Faster person search in the back office.** The "One person" list now comes from a GET route (/admin/api/find-users) instead of a server action, because server actions run one at a time and typing queued them up. Emails and names are matched in parallel with the other field joined in (one round trip), the audit entry is written after the answer is sent, the browser cancels stale searches, and answers are kept for the visit so going back over a name is instant.

**D-142 Three CV designs.** Classic (centred name, navy headings), Modern (name on the left, blue accents) and Executive (serif type, black only). All three keep the CV writing standard: one column, real selectable text, standard headings, no tables, icons, photos or graphics, so applicant tracking systems read them the same way. The design is picked before download (PDF and Word), the screen preview follows it, and the last choice is remembered on that device.

**D-143 Review the general CV before downloading.** "Download my CV" now leads to a review screen (/experience/cv/[id]) with the same editor as a tailored CV: every line can be edited or put back, and any line with words we couldn't trace is marked so it can be fixed, kept or removed first. The quick downloads only show when nothing needs a look.

**D-144 Browser extension, version 2.** A side panel instead of a popup, so it stays open while browsing. It signs in through the app ("Connect the extension": a long random key for that browser, only its hash stored, revocable from the panel or the app), shows who is signed in, finds the job on the page by itself (highlighted text, the page's schema.org JobPosting data, known job boards, then the block that reads most like an advert), checks if it's real inside the panel, saves it for later, or sends it to the app to tailor. Adverts in pictures are read by scanning the screen, picking an image on the page, or right-clicking an image (images are fetched by our server through the same private address checks as links). It reads a page only while the panel is open, after Chrome asks once, and sends only the job. API: /api/ext/me, capture, check, save, signout, each with per person hourly limits. Built by `npm run extension:build`.

**D-145 Outlined fields on tinted panels.** The add achievement box sat on a white card inside a tinted panel, where the grey input well vanished when empty. Fields there now use an outlined style (visible border at rest). Tailwind class overrides on the shared input style were also unreliable (two border colours in one class list), so variants are separate classes.

**D-146 Market review.** docs/MARKET.md: competitors by group (global AI CV tools, Nigerian job boards, local career tools, interview practice, scam checkers, autofill), where we lead (truth with a fact lock, a real free scam check, Naira pricing and Nigerian formats, one loop from fit to interview), where we trail (distribution, job supply, templates, proof of results, name), and how to win (own "proof", lead with the shareable scam check, win NYSC and final year students, an employer side later, keep pricing local, measure the loop).

**D-147 Shareable job checks.** "Share this check" (app and extension) makes a public link, /c/[code], with the job post's title, employer, where it was posted, the verdict and what was checked, plus a preview card for WhatsApp and X. Never who checked it, never the post's text, and phone numbers and emails in findings are hidden. The page says it's about one post, not the company named in it (scammers use real names), and is never indexed; one link per job, refreshed when shared again. WhatsApp first, then X, copy and the phone's share sheet. Opens are counted.

**D-148 CV designs follow demand.** Three ATS safe designs stay. Every download records which design (anonymously), and "None of these? Tell us what you'd like" records what people want (more colour, fits on one page, two columns, a photo, more creative). The back office overview shows downloads by design and the requests, with a rule of thumb: add a design when one request reaches about 1 in 10 downloads, and weigh two column and photo requests against what hiring software can read.

**D-149 Extension panel fix.** The panel looked at the page address before asking for permission to read pages; Chrome hides the address until then, so it said "Open a job advert" with no buttons on real job pages. Permission now comes first, every state has a button (read again, scan the screen), a connection problem says which address it tried, and a protected deployment no longer signs the extension out.

**D-150 Engineering pass.** (1) The zod validation library was shipped to phones on My Experience through a label import; labels moved to a zod free module, cutting that page's first load from 298.5KB to about 270KB. (2) Analytics are sent after the response instead of during it, so no screen waits on PostHog. (3) The vault and contact details are read once per request. (4) Indexes for the most common queries (jobs by person and state, applications by job, CV versions by person and job, achievements by role). (5) Screen level error panels in the app and back office, so one failing screen keeps the menu and offers "Try again". (6) Dead code removed.

**D-151 Salary isn't a fee.** The scam check flagged posts that mentioned pay ("Pay: ₦150,000 monthly") as asking for money. Layer 1 now reads sentence by sentence and flags only a request for the applicant to pay: a fee (registration, application, form, processing, training, medical, uniform), or "pay" or "send money" to an account that isn't about salary. Lines that say there is no fee are skipped. parse_job v2 tells the model the same: payment_mentioned is true only when the applicant is asked to pay. Tested with 14 lines (6 asks, 8 salary or no fee lines).

**D-152 Checking the company and where the job was posted.** (1) Company record: Wikidata and DuckDuckGo's instant answers are asked together, and only an exact name match that reads like a company counts. The website and founding year come from either. (2) Web search: when `SERPER_API_KEY` (or Brave, or Google Programmable Search) is set, the check searches for the company's official site, the job on its careers page, public scam reports about the company, and the email or phone in the post, and feeds the results to the legitimacy step as numbered sources. Without a key it falls back to Gemini's search, which needs Gemini billing. (3) New finding L2-11, "Where the job was posted": the company's own site or its own hiring board counts in favour; a known job board (config/lists/job_sources.json) is noted as a known site; a link shortener, a social media post, a free website host, a site that borrows the company's name, or a domain under 180 days old is a warning (amber, never red on its own); pasted text with no link is "couldn't check". Recommended for best results: a Serper key, Gemini billing, CAC records access when available, and keeping job_sources.json current.

**D-153 Signature, a fourth CV design.** Founder asked for a beautiful design that hiring software still reads. Signature has a deep teal header band with the name in white, a light contact strip, teal square markers beside spaced capital headings with a fine rule, and the employer in teal. Still one column, real selectable text, standard headings, no tables, icons, photos or text in images, so applicant tracking systems read it like the other three. PDF and Word both have it, and the preview follows it.

**D-154 Share as a picture.** (Removed in D-158.) A 1080 by 1350 picture of the check (/c/[code]/card), sized for WhatsApp and status: a coloured verdict band (green "Looks genuine", amber "Couldn't confirm it", red "Warning signs") with a shield, the job title, employer, location and where it was posted, up to six checks with marks, and a footer with the link and "About this one post, not the company named in it. Never pay to apply." Same privacy as the link: no name, no post text, contacts hidden. On phones, "Share as a picture on WhatsApp" opens the share sheet with the picture and words together; on laptops, which can't pass a picture to WhatsApp, the picture is saved and WhatsApp opens with the words, ready to attach. The link button stays.

**D-155 The scanned job stays open in the extension.** After a scan, the panel keeps showing that job (its results, or the job card) when the person moves to another page or tab, until they press Close on its card. A note says "Still showing the job you scanned on {site}. It stays here until you close it." with "Scan this page instead". Saved for the browser session only. Words used: "Scan this page", "Scan this page again", "Close".

**D-156 Company age from search, jobs posted only on job sites, and kinder wording.** Founder round 19. (1) "How long it has been around" now reads the search results: a year counts only from a sentence or page title that names the company ("Cowrywise was established in 2017", "Founded 2017" on its LinkedIn page), the year most pages agree on wins, and when the other searches don't say, one more search ("Company" founded) is made, only when the company record has no year. Tested live: Kuda 2019, Cowrywise 2017, Helium Health 2016, Paystack 2015 (record); a made up "Northbridge Bank" gets no year from pages about other banks. Website age (RDAP, which also answers for .ng) stays the last resort. (2) Many companies post jobs only on LinkedIn, Indeed or Jobberman. The check now searches those sites for the same job under the company's name, and a job found there, or on the job site where the person found it, counts as "Listed under the company's name" (a pass), with "Many companies post jobs only on job sites, so that's normal." A matching job on the company's own careers page is now found in code too. Not finding it anywhere shows "Not found" in grey, never a fail, and says it isn't a warning on its own. (3) The verdict for "couldn't fully confirm" now depends on what we found: with a real company and no warning signs it reads "No warning signs found" (blue, not amber) with a headline that says what we found and to never pay; with any warning sign it stays "We couldn't confirm it. Be careful."; with little found it says that doesn't mean it's fake. Never "safe", and the Build pack's verified rule is unchanged (official channel plus a matching email or link). The same wording shows in the extension and on shared checks. Each check uses about 5 or 6 searches.

**D-157 CV typefaces.** The PDF designs used the built in Helvetica and Times. Each design now embeds a free, open licence typeface chosen for reading: Classic, Source Sans 3; Modern, Inter; Executive, Source Serif 4; Signature, Plus Jakarta Sans. All include ₦, which used to print as "NGN". Fonts are cut down to the letters used (PDFs stay around 15 to 30KB), ligatures are off so "fi" stays two letters, and letter spaced headings are drawn as one run, so hiring software reads "EXPERIENCE", not "E X P E R I E N C E" (checked by extracting the text of all four). Word files use the nearest standard font (Calibri, Arial, Georgia) so they look the same on any computer, and the design picker names both. Licences and sources: lib/cv/fonts/README.md.

**D-158 Picture sharing removed.** Founder asked to return sharing to how it was before D-154: the WhatsApp picture card (/c/[code]/card) and its buttons are gone from the app and the extension. Sharing is the link again (WhatsApp, X, copy, the phone's share sheet), with the link preview card from D-147.

**D-159 Round 20 screen fixes.** (1) The browser extension starts afresh each time it's opened: the scanned job stays only while the panel is open (D-155 kept it for the browser session). (2) Share buttons show the WhatsApp and X logos. (3) Bottom sheets on phones open taller (route modals at least 80% of the screen, confirmations about half), with buttons at the bottom. (4) Settings on laptops and tablets puts "Chrome extension" beside the heading, on the right; phones keep it in the list. (5) The email screen explains sending as three steps: get the CV file, open your email with everything filled in (or share the CV to Gmail on phones), press Send and come back. (6) "Next: prepare your email" is a real button beside Download CV, and a card at the end of the CV panel says what happens next. (7) Download PDF and Download Word file became one "Download CV" button with a choice of PDF or Word. (8) On laptops and tablets the CV screen's header, with its two buttons side by side, is filled and sticks to the top; "Before you download" now comes before "What we changed". (9) On the fit check, the job and the advice stick to the top on laptops and tablets as one compact band with smaller buttons; on phones long advice folds behind "See more", each requirement folds with its status still showing, and Save for later and Tailor my CV repeat under the match list.

**D-160 Laptop and tablet shell without a top bar.** The top bar is gone on wide screens. Notifications (with the count), Get help and the profile (name, stage, link to settings) sit in the sidebar; the search box is gone (search lives on My Applications); "Tailor my CV" floats at the bottom right of every screen except the job flow (/jobs) and the pass page. Phones keep their top bar and the centre Tailor button. "Applications" is now "My Applications" (the phone tab keeps the short "Applied").

**D-161 Verified includes job sites, and no second check on the way back.** Founder said yes: a job listed under the company's name on a known job site now counts toward Verified when the email or apply link is on the company's own website or hiring page, because the application then reaches the real company. Forum and news posts never count, and Verified is never shown with an amber or red sign. Coming back to the fit check or "Is this job real?" shows the saved check straight away (fresh for 7 days) instead of asking the server again.

**D-162 Summary, skills and referees.** My Experience has a "Summary, Skills and Referees" section: the person's own profile summary, their skills list, and up to four referees (name, job title, organisation, how they know them, phone, email). Uploading a CV now copies its summary, skills and referees there (parse_cv v4); before, the skills list was read and dropped, and summaries and referees were ignored. On the fit check, any requirement not met has "I have this: add it": the person names the skill (and, privately, where they used it). Those additions are kept apart on My Experience ("Added while checking jobs", removable), always go in the Skills section of their CVs, and count as met in the match percentage; the verdict isn't re-run, so no AI cost. Referees are named on Nigerian format CVs when the person has added them, and on UK CVs when the job asks; otherwise "Available on request" (the UK format now has a Referees section too). Stored on the profiles row (migration section 19), owner only.

**D-163 Suggestions only count when accepted.** Every reworded CV line is a suggestion: it shows "Suggested" with Accept, Keep my words and Compare, and "Accept all" is in What we changed. The profile summary for each job starts from the person's own summary (tailor_cv v2) and waits for "Use this", "Keep my own" or an edit. The downloaded file uses only what was accepted: a line not accepted prints in the person's own words, an unconfirmed summary prints as their own. Before download, one sheet lists the summary to confirm, suggestions not accepted and lines to check, with "Download now" always available. Rewording must keep each line's context: the same task, setting, scale and result (tailor_cv v2 rule). CVs made before this are treated as accepted.

**D-164 Match percentage.** The fit check shows a match ring ("78% match to this job"), worked out in code: each requirement in the post counts, must-haves twice nice-to-haves, met fully, partly met half, missing nothing; skills added on the check count as met. Hard rules stay separate in the verdict. The browser extension has "See how well I match", which runs the same fit check for the job it captured (/api/ext/fit, 20 an hour) and shows the ring, the verdict, requirements met and the main gaps, with a link to the full check. The extension's request runs with the service role inside a scoped client (lib/supabase/server.ts withClient) only on code paths whose every query filters by the person's id.

**D-165 CVs can run to two pages.** tailor_cv v2: 4 to 6 bullets for recent or relevant roles and 2 to 3 for older ones, every role that shows a skill or duty the job asks for, never cutting strong evidence to fit one page and never padding. All formats allow two pages (config/country_profiles, unchanged at 2, 3 for long Nigerian private sector careers).

**D-166 Interview questions modelled on real panels.** From the founder's question bank and an NHS receptionist set: shortlist_questions v3 builds 14 to 18 questions across the families panels use (motivation and the role, values, communication, confidentiality, administration and records, pressure, teamwork, role procedures, competency, situational judgement, career and closing), with sector values (for example NHS values in UK healthcare) and realistic scenes from that workplace, matched to the person's level. "Do you have any questions for us?" always closes the list. Each question shows how to answer it: STAR for experience, what you'd do and when you'd escalate for scenarios, linking to the role for motivation, a genuine example for values. The standard question bank (config/lists/interview_questions.json) grew to 13 questions across those families.

**D-167 AIApply and Totaljobs.** docs/MARKET.md: AIApply is an auto apply and AI CV suite (dollar priced, reviews report invented CV content and billing trouble); it overlaps on tailoring and interview practice but sends applications for people and doesn't keep CVs true, which is our opposite. Totaljobs is a large UK job board, a source of jobs rather than a rival, already on our known job sites list. Neither does what we do end to end.

