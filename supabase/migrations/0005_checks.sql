-- Slice 4: verdict caching and survey answers.

alter table public.verdicts add column if not exists cache_key text;
alter table public.verdicts add column if not exists line text;
alter table public.verdicts add column if not exists forced_by_rules boolean not null default false;
alter table public.verdicts add column if not exists overridden_at timestamptz;
create index if not exists verdicts_job_idx on public.verdicts (job_id, created_at desc);
create index if not exists eligibility_job_idx on public.eligibility_results (job_id, created_at desc);
create index if not exists legitimacy_job_idx on public.legitimacy_checks (job_id, created_at desc);

-- One tap research surveys (PRD research plan). Answers only, no free text.
create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  survey text not null check (survey in ('verdict_helpful', 'send_as_is', 'applied_anyway')),
  answer text not null check (char_length(answer) <= 20),
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.survey_answers enable row level security;
create policy survey_insert_own on public.survey_answers for insert to authenticated with check (user_id = (select auth.uid()));
create policy survey_select_own on public.survey_answers for select to authenticated using (user_id = (select auth.uid()));
