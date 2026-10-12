-- Receipts MVP schema, Build pack section 4.
-- Every user owned table carries user_id and row level security so a user can
-- only ever read and write their own rows. Dates are stored in UTC (timestamptz).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.consent_type as enum ('terms', 'privacy', 'marketing', 'sensitive_details', 'question_bank');
create type public.role_kind as enum ('job', 'internship_siwes', 'nysc_ppa', 'volunteer', 'project', 'education', 'certification', 'licence');
create type public.ownership as enum ('did', 'helped', 'led');
create type public.item_source as enum ('cv_import', 'voice', 'text');
create type public.job_source as enum ('paste', 'link', 'screenshot', 'share');
create type public.legitimacy_state as enum ('verified', 'unverified', 'red_flags');
create type public.verdict as enum ('apply', 'apply_with_care', 'skip');
create type public.pack_channel as enum ('email', 'form', 'portal');
create type public.application_status as enum (
  'draft', 'packed', 'sent', 'no_response', 'rejected', 'assessment',
  'interview', 'second_interview', 'offer', 'accepted', 'withdrawn'
);
create type public.outcome_source as enum ('tap', 'forwarded_email', 'pasted_sms', 'auto_30d');
create type public.pass_type as enum ('trial_3d', 'job_hunt_30d', 'interview_boost');
create type public.pass_status as enum ('pending', 'active', 'expired', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Users, consent, profile
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  auth_provider text not null default 'email',
  career_stage text,
  target_markets text[] not null default '{}' check (cardinality(target_markets) <= 3),
  low_data_mode boolean not null default false,
  age_confirmed_at timestamptz,
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);
create index consents_user_type_idx on public.consents (user_id, type, created_at desc);

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  full_name text,
  phone text,
  contact_email text,
  city text,
  state text,
  linkedin_url text,
  right_to_work jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Encrypted at the application layer (lib/crypto/sensitive.ts, AES-256-GCM with the
-- user id as additional data). The database only ever holds ciphertext.
create table public.sensitive_details (
  user_id uuid primary key references public.users (id) on delete cascade,
  date_of_birth_enc text,
  gender_enc text,
  state_of_origin_enc text,
  nysc_status_enc text,
  nysc_start_enc text,
  nysc_end_enc text,
  updated_at timestamptz not null default now()
);

create table public.olevel_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  exam text not null check (exam in ('WAEC', 'NECO', 'GCE')),
  year int not null,
  subjects jsonb not null default '[]'::jsonb,
  sittings int not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Evidence vault
-- ---------------------------------------------------------------------------
create table public.vault_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind public.role_kind not null,
  organisation text,
  title text,
  location text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  grade text,
  grade_scale text,
  source public.item_source not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_roles_user_idx on public.vault_roles (user_id);

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references public.vault_roles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null,
  metrics jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  ownership public.ownership not null default 'did',
  source_quote text,
  source_type public.item_source not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_items_user_idx on public.vault_items (user_id);

-- ---------------------------------------------------------------------------
-- Employers (shared, no personal data) and jobs
-- ---------------------------------------------------------------------------
create table public.employers (
  id uuid primary key default gen_random_uuid(),
  normalised_name text not null unique,
  domains text[] not null default '{}',
  cac_rc_number text,
  careers_url text,
  last_checked_at timestamptz
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source_type public.job_source not null,
  raw_text text,
  raw_image_path text,
  source_url text,
  post_hash text not null,
  parsed jsonb,
  employer_id uuid references public.employers (id),
  destination_country text,
  destination_confidence numeric(3, 2),
  destination_set_by_user boolean not null default false,
  deadline date,
  captured_at timestamptz not null default now()
);
create index jobs_user_idx on public.jobs (user_id, captured_at desc);
create index jobs_post_hash_idx on public.jobs (post_hash);

create table public.eligibility_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  rule_set_version text not null,
  results jsonb not null,
  overall text not null check (overall in ('pass', 'fail', 'unknown')),
  created_at timestamptz not null default now()
);

create table public.legitimacy_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  employer_id uuid references public.employers (id),
  rule_flags jsonb not null default '[]'::jsonb,
  lookup_findings jsonb not null default '[]'::jsonb,
  state public.legitimacy_state not null,
  cached_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  verdict public.verdict not null,
  requirements jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  model text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CVs, packs, applications
-- ---------------------------------------------------------------------------
create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  format_profile text not null,
  content jsonb not null,
  pdf_path text,
  docx_path text,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

-- A packed CV version is frozen. Edits create a new version.
create or replace function public.cv_versions_lock_guard() returns trigger
language plpgsql as $$
begin
  if old.locked_at is not null then
    raise exception 'cv_version % is locked; create a new version', old.id;
  end if;
  return new;
end $$;
create trigger cv_versions_lock_guard before update on public.cv_versions
  for each row execute function public.cv_versions_lock_guard();

create table public.application_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  channel public.pack_channel not null,
  to_email text,
  subject text,
  body text,
  attachment_names text[] not null default '{}',
  form_fields jsonb,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete restrict,
  cv_version_id uuid references public.cv_versions (id) on delete restrict,
  pack_id uuid references public.application_packs (id) on delete restrict,
  job_snapshot jsonb,
  sent_at timestamptz,
  status public.application_status not null default 'draft',
  status_verified boolean not null default false,
  next_check_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_idx on public.applications (user_id, created_at desc);

-- The job snapshot never changes after send.
create or replace function public.applications_snapshot_guard() returns trigger
language plpgsql as $$
begin
  if old.sent_at is not null and new.job_snapshot is distinct from old.job_snapshot then
    raise exception 'job_snapshot is frozen after send';
  end if;
  return new;
end $$;
create trigger applications_snapshot_guard before update on public.applications
  for each row execute function public.applications_snapshot_guard();

create table public.outcome_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  source public.outcome_source not null,
  evidence_text text,
  created_at timestamptz not null default now()
);

create table public.debriefs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  transcript text,
  questions jsonb not null default '[]'::jsonb,
  format text,
  panel text,
  share_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.shortlist_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  invite_details jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  drill_attempts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money and entitlements. Users can read, never write: only the verified
-- Paystack webhook (service role) unlocks a pass.
-- ---------------------------------------------------------------------------
create table public.passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.pass_type not null,
  amount_kobo int not null default 0,
  paystack_reference text unique,
  status public.pass_status not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.usage_counters (
  user_id uuid primary key references public.users (id) on delete cascade,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_cvs_used int not null default 0
);

-- ---------------------------------------------------------------------------
-- Versioned config data and audit (service role only)
-- ---------------------------------------------------------------------------
create table public.rule_sets (
  version text primary key,
  rules jsonb not null,
  reviewed_by text,
  published_at timestamptz
);

create table public.country_profiles (
  version text primary key,
  rules jsonb not null,
  reviewed_by text,
  published_at timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  at timestamptz not null default now()
);

-- Landing page waitlist (D-004). Insert only; nobody can read it through the API.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger users_touch before update on public.users for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger sensitive_touch before update on public.sensitive_details for each row execute function public.touch_updated_at();
create trigger vault_roles_touch before update on public.vault_roles for each row execute function public.touch_updated_at();
create trigger vault_items_touch before update on public.vault_items for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user: create the app user row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, auth_provider)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  insert into public.profiles (user_id, full_name, contact_email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  insert into public.usage_counters (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.consents enable row level security;
alter table public.profiles enable row level security;
alter table public.sensitive_details enable row level security;
alter table public.olevel_results enable row level security;
alter table public.vault_roles enable row level security;
alter table public.vault_items enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.eligibility_results enable row level security;
alter table public.legitimacy_checks enable row level security;
alter table public.verdicts enable row level security;
alter table public.cv_versions enable row level security;
alter table public.application_packs enable row level security;
alter table public.applications enable row level security;
alter table public.outcome_events enable row level security;
alter table public.debriefs enable row level security;
alter table public.shortlist_sessions enable row level security;
alter table public.passes enable row level security;
alter table public.usage_counters enable row level security;
alter table public.rule_sets enable row level security;
alter table public.country_profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.waitlist enable row level security;

-- users: read and update own row (no insert or delete through the API)
create policy users_select_own on public.users for select to authenticated using (id = (select auth.uid()));
create policy users_update_own on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- consents are append only from the client: insert and read own rows
create policy consents_select_own on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents for insert to authenticated with check (user_id = (select auth.uid()));

-- Full own-row access for user owned data tables
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'sensitive_details', 'olevel_results', 'vault_roles', 'vault_items',
    'jobs', 'eligibility_results', 'legitimacy_checks', 'verdicts', 'cv_versions',
    'application_packs', 'applications', 'debriefs', 'shortlist_sessions'
  ] loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete_own on public.%1$s for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- outcome_events: append only
create policy outcome_events_select_own on public.outcome_events for select to authenticated using (user_id = (select auth.uid()));
create policy outcome_events_insert_own on public.outcome_events for insert to authenticated with check (user_id = (select auth.uid()));

-- passes and usage counters: read only for the owner; writes go through the service role
create policy passes_select_own on public.passes for select to authenticated using (user_id = (select auth.uid()));
create policy usage_select_own on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- employers: shared, read only, no personal data
create policy employers_read on public.employers for select to authenticated using (true);

-- rule_sets and country_profiles: published versions are readable
create policy rule_sets_read on public.rule_sets for select to authenticated using (published_at is not null);
create policy country_profiles_read on public.country_profiles for select to authenticated using (published_at is not null);

-- waitlist: anyone may join; nobody may read through the API
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);

-- audit_log: no policies, so only the service role can touch it.

-- Column level limits: a user may change their own preferences, never their
-- email, provider or timestamps that the server owns.
revoke update on public.users from authenticated;
grant update (career_stage, target_markets, low_data_mode, age_confirmed_at, setup_completed_at) on public.users to authenticated;
