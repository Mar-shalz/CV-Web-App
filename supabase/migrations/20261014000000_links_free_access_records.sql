-- Run this whole file once in Supabase > SQL Editor. It is safe to run again: every
-- step checks whether it already happened.

-- 1. Portfolio and website on the CV (optional).
alter table public.profiles add column if not exists portfolio_url text check (portfolio_url is null or portfolio_url ~* '^https?://');
alter table public.profiles add column if not exists website_url text check (website_url is null or website_url ~* '^https?://');

-- 2. Free access: the founder can let family and testers use everything without paying.
-- Matched on the email they sign in with, so it works before or after they sign up.
-- People can see only their own grant; only the back office (service role) writes.
create table if not exists public.free_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  note text check (char_length(note) <= 120),
  ends_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists free_access_email_live_idx on public.free_access (lower(email)) where revoked_at is null;
alter table public.free_access enable row level security;
drop policy if exists free_access_select_own on public.free_access;
create policy free_access_select_own on public.free_access for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')) and revoked_at is null);
revoke insert, update, delete on public.free_access from anon, authenticated;

-- 3. Applications sent with a CV made somewhere else: the file they sent, kept privately
-- in their own folder so they can see exactly what the employer has.
alter table public.applications add column if not exists external_cv_path text;
alter table public.applications add column if not exists external_cv_name text;
alter table public.applications add column if not exists source text not null default 'tailored' check (source in ('tailored', 'logged'));

-- The CV they sent can be up to 10MB, like other uploads.
update storage.buckets set file_size_limit = 10485760 where id = 'cv-exports';

-- 4. Interview questions found on the web for Shortlist mode, with their sources.
alter table public.shortlist_sessions add column if not exists web_questions jsonb not null default '[]'::jsonb;

-- 5. Employment type on work roles. Only part time and contract are printed on the CV;
-- empty means full time.
alter table public.vault_roles add column if not exists employment_type text check (employment_type is null or employment_type in ('full_time', 'part_time', 'contract'));

-- 6. Suspended accounts. Set only by the back office (the service role): users have no
-- update grant on these columns.
alter table public.users add column if not exists suspended_at timestamptz;
alter table public.users add column if not exists suspended_reason text check (char_length(suspended_reason) <= 200);

-- 7. How often people use the app: one row per person per day (Lagos time) with a visit
-- count and the country the visit came from (from the host's IP lookup; no IP address,
-- city, pages, content or device is stored). Written by the server only.
create table if not exists public.user_activity (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  views int not null default 1,
  last_at timestamptz not null default now(),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  primary key (user_id, day)
);
alter table public.user_activity add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
create index if not exists user_activity_day_idx on public.user_activity (day);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;

drop function if exists public.touch_activity(uuid);
create or replace function public.touch_activity(p_user uuid, p_country text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.user_activity (user_id, day, views, last_at, country)
  values (p_user, (now() at time zone 'Africa/Lagos')::date, 1, now(), p_country)
  on conflict (user_id, day) do update
    set views = public.user_activity.views + 1, last_at = now(), country = coalesce(excluded.country, public.user_activity.country);
$$;
revoke all on function public.touch_activity(uuid, text) from public, anon, authenticated;
grant execute on function public.touch_activity(uuid, text) to service_role;

-- 8. Team members can be paused (no back office access until reactivated).
alter table public.admin_members add column if not exists paused_at timestamptz;

-- 9. People can delete an application. The back office still counts it: a per person
-- tally of deleted applications (no job, CV or employer kept).
alter table public.usage_counters add column if not exists applications_deleted int not null default 0;
create or replace function public.count_deleted_application(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  update public.usage_counters set applications_deleted = applications_deleted + 1 where user_id = p_user;
$$;
revoke all on function public.count_deleted_application(uuid) from public, anon, authenticated;
grant execute on function public.count_deleted_application(uuid) to service_role;

-- 10. Willingness to pay: taps on the price on the landing page. Anonymous: a random
-- browser id only, no IP, no account.
create table if not exists public.price_clicks (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor text check (char_length(visitor) <= 64),
  source text check (char_length(source) <= 40)
);
alter table public.price_clicks enable row level security;
revoke all on public.price_clicks from anon, authenticated;

-- 11. CV top-up: more tailored CVs during a job hunt pass (prices and amounts in
-- config/prices.json). Activates through the same verified Paystack webhook.
alter type public.pass_type add value if not exists 'cv_topup';

-- 12. Back office messages: history of everything sent (groups and one person), drafts,
-- and recall. A recalled message is taken out of the person's Updates panel. Staff only:
-- read and written with the service role from the back office.
create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users (id) on delete set null,
  audience text not null check (audience in ('everyone', 'trial', 'pass', 'no_pass', 'person')),
  recipient_id uuid references public.users (id) on delete set null,
  recipient_email text check (char_length(recipient_email) <= 160),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 600),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.#-]*$'),
  days int check (days between 1 and 90),
  status text not null default 'draft' check (status in ('draft', 'sent', 'recalled')),
  announcement_id uuid references public.announcements (id) on delete set null,
  notification_id uuid,
  sent_at timestamptz,
  recalled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_messages_created_idx on public.admin_messages (created_at desc);
alter table public.admin_messages enable row level security;
revoke all on public.admin_messages from anon, authenticated;

-- 13. People can put the achievements in each role in their own order.
alter table public.vault_items add column if not exists position int;

-- 14. Downloading the same CV again replaces its stored copy, which needs an update rule
-- on people's own files (same folder rule as the others).
drop policy if exists "own files update" on storage.objects;
create policy "own files update" on storage.objects for update to authenticated
  using (bucket_id in ('job-uploads', 'cv-exports') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('job-uploads', 'cv-exports') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 15. The browser extension's sign in: a long, random key per connected browser, made
-- when the person taps "Connect" in the app while signed in. Only a hash of the key is
-- kept. Staff only through the service role; people revoke theirs from the app.
create table if not exists public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label text check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz
);
create index if not exists extension_tokens_user_idx on public.extension_tokens (user_id);
alter table public.extension_tokens enable row level security;
revoke all on public.extension_tokens from anon, authenticated;

-- 16. Shareable job checks: a public link with the verdict on one job post. Holds the post's
-- title, employer and what we checked, never who checked it publicly (user_id is kept only
-- so the owner can stop sharing and for deletion). Read by slug through the service role.
create table if not exists public.check_shares (
  slug text primary key check (slug ~ '^[A-Za-z0-9]{10}$'),
  job_id uuid references public.jobs (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  title text check (char_length(title) <= 200),
  employer text check (char_length(employer) <= 160),
  location text check (char_length(location) <= 160),
  source_host text check (char_length(source_host) <= 120),
  state text not null check (state in ('verified', 'unverified', 'red_flags')),
  headline text check (char_length(headline) <= 600),
  checks jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  views int not null default 0
);
create unique index if not exists check_shares_job_idx on public.check_shares (job_id) where job_id is not null;
alter table public.check_shares enable row level security;
revoke all on public.check_shares from anon, authenticated;

-- 17. CV design usage, so new designs are added when people ask for them: downloads per
-- design and requests for other designs. No user id, no CV content.
create table if not exists public.cv_design_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('download', 'request')),
  style text check (char_length(style) <= 20),
  reason text check (char_length(reason) <= 40)
);
create index if not exists cv_design_events_at_idx on public.cv_design_events (at desc);
alter table public.cv_design_events enable row level security;
revoke all on public.cv_design_events from anon, authenticated;

-- 18. Indexes for the queries the app runs most (founder round 17 engineering pass).
create index if not exists jobs_user_state_idx on public.jobs (user_id, state);
create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists cv_versions_user_job_idx on public.cv_versions (user_id, job_id, created_at desc);
create index if not exists vault_items_role_idx on public.vault_items (role_id);
