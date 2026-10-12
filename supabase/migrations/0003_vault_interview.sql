-- Slices 1 and 2: rate limits on AI endpoints and story interview sessions.

-- Fixed window rate limit per user and bucket (Build pack section 10: rate limits on
-- every AI endpoint). Security definer so it can write the events table, which has
-- no policies of its own. Returns true when the call is allowed.
create table public.rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  bucket text not null,
  at timestamptz not null default now()
);
create index rate_events_lookup on public.rate_events (user_id, bucket, at desc);
alter table public.rate_events enable row level security;

create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  used int;
begin
  if uid is null then
    return false;
  end if;
  select count(*) into used from public.rate_events
    where user_id = uid and bucket = p_bucket and at > now() - make_interval(secs => p_window_seconds);
  if used >= p_max then
    return false;
  end if;
  insert into public.rate_events (user_id, bucket) values (uid, p_bucket);
  -- Keep the table small: drop this user's events older than a day.
  delete from public.rate_events where user_id = uid and at < now() - interval '1 day';
  return true;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public;
grant execute on function public.rate_limit_hit(text, int, int) to authenticated;

-- Story interview: one session per role, resumable from the same question.
create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid references public.vault_roles (id) on delete cascade,
  turns jsonb not null default '[]'::jsonb,
  current_question jsonb,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_sessions_user_idx on public.interview_sessions (user_id, updated_at desc);
alter table public.interview_sessions enable row level security;
create policy interview_sessions_select_own on public.interview_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy interview_sessions_insert_own on public.interview_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy interview_sessions_update_own on public.interview_sessions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy interview_sessions_delete_own on public.interview_sessions for delete to authenticated using (user_id = (select auth.uid()));
create trigger interview_sessions_touch before update on public.interview_sessions for each row execute function public.touch_updated_at();
