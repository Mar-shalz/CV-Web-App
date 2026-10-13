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

-- 7. How often people use the app: one row per person per day (Lagos time) with a page
-- view count. No pages, content or devices are stored. Written by the server only.
create table if not exists public.user_activity (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  views int not null default 1,
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists user_activity_day_idx on public.user_activity (day);
alter table public.user_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;

create or replace function public.touch_activity(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.user_activity (user_id, day, views, last_at)
  values (p_user, (now() at time zone 'Africa/Lagos')::date, 1, now())
  on conflict (user_id, day) do update set views = public.user_activity.views + 1, last_at = now();
$$;
revoke all on function public.touch_activity(uuid) from public, anon, authenticated;
grant execute on function public.touch_activity(uuid) to service_role;
