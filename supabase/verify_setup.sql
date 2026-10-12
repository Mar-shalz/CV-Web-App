-- Paste this whole file into the Supabase SQL editor and press Run.
-- It changes nothing. It shows, for each migration file, whether it is already in
-- your database. Run only the files marked "not applied", in order.
with checks(migration, what, ok) as (
  values
    ('0001_init.sql', 'tables and types', to_regclass('public.applications') is not null and to_regtype('public.consent_type') is not null),
    ('0002_back_office.sql', 'back office tables', to_regclass('public.admin_members') is not null and to_regclass('public.truth_reports') is not null),
    ('0003_vault_interview.sql', 'rate limits and interview sessions', to_regclass('public.rate_events') is not null and to_regclass('public.interview_sessions') is not null),
    ('0004_jobs_storage.sql', 'file buckets and job columns', exists (select 1 from storage.buckets where id = 'job-uploads') and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'jobs' and column_name = 'parse_status')),
    ('0005_checks.sql', 'verdict cache and surveys', to_regclass('public.survey_answers') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'verdicts' and column_name = 'cache_key')),
    ('0006_pack_log.sql', 'pack checklist and check in count', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'application_packs' and column_name = 'checklist') and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'applications' and column_name = 'check_ins_done')),
    ('0007_outcomes_shortlist_payments.sql', 'payment log and No reply job', to_regclass('public.payment_events') is not null and to_regprocedure('public.activate_pass(text,integer,text,integer)') is not null),
    ('0008_hardening.sql', 'account deletion keys', exists (select 1 from pg_constraint where conname = 'applications_job_id_fkey' and confdeltype = 'a'))
)
select migration, what, case when ok then 'applied' else 'NOT APPLIED: run this file' end as status
from checks
order by migration;
