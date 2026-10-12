-- Slice 6 and 7: application packs, the log and outcomes.

alter table public.application_packs add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.application_packs add column if not exists portal_steps jsonb not null default '[]'::jsonb;
alter table public.application_packs add column if not exists apply_url text;
alter table public.applications add column if not exists check_ins_done int not null default 0;
alter table public.applications add column if not exists schedule_kind text not null default 'private' check (schedule_kind in ('private', 'programme'));
create index if not exists applications_checkin_idx on public.applications (status, next_check_in_at);
create unique index if not exists applications_one_open_per_job on public.applications (job_id) where status in ('draft', 'packed');

alter table public.jobs drop constraint if exists jobs_state_check;
alter table public.jobs add constraint jobs_state_check check (state in ('captured', 'reviewed', 'checked', 'saved', 'skipped', 'applying', 'applied'));
