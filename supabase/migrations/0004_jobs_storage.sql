-- Slices 3 to 6: private file storage and job workflow columns.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('job-uploads', 'job-uploads', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('cv-exports', 'cv-exports', false, 2097152, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Each user's files live under a folder named with their user id. Signed links are
-- made on the server and expire within 10 minutes (Build pack section 10).
create policy "own files select" on storage.objects for select to authenticated
  using (bucket_id in ('job-uploads', 'cv-exports') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('job-uploads', 'cv-exports') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('job-uploads', 'cv-exports') and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.jobs add column if not exists parse_status text not null default 'parsed' check (parse_status in ('parsed', 'manual'));
alter table public.jobs add column if not exists destination_signals jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists reviewed_at timestamptz;
alter table public.jobs add column if not exists state text not null default 'captured'
  check (state in ('captured', 'reviewed', 'checked', 'saved', 'skipped', 'applying'));
