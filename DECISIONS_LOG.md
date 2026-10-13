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
