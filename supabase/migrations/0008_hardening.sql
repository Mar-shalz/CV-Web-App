-- Slice 10: account deletion must remove everything in one go.

-- RESTRICT is checked the moment a job, CV or pack row goes, before the cascade from
-- users reaches the application that points at it, so deleting an account failed.
-- NO ACTION keeps the same protection (you still can't delete a job that has an
-- application) but checks at the end of the statement, after the cascade.
alter table public.applications drop constraint if exists applications_job_id_fkey;
alter table public.applications add constraint applications_job_id_fkey foreign key (job_id) references public.jobs (id) on delete no action;
alter table public.applications drop constraint if exists applications_cv_version_id_fkey;
alter table public.applications add constraint applications_cv_version_id_fkey foreign key (cv_version_id) references public.cv_versions (id) on delete no action;
alter table public.applications drop constraint if exists applications_pack_id_fkey;
alter table public.applications add constraint applications_pack_id_fkey foreign key (pack_id) references public.application_packs (id) on delete no action;

-- Staff who leave and delete their own account don't block it.
alter table public.admin_members drop constraint if exists admin_members_added_by_fkey;
alter table public.admin_members add constraint admin_members_added_by_fkey foreign key (added_by) references public.users (id) on delete set null;
alter table public.truth_reports drop constraint if exists truth_reports_resolved_by_fkey;
alter table public.truth_reports add constraint truth_reports_resolved_by_fkey foreign key (resolved_by) references public.users (id) on delete set null;
