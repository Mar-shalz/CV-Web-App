-- Slices 7 to 9: outcomes, Shortlist mode and payments.

-- Outcomes ------------------------------------------------------------------
alter table public.debriefs add column if not exists mode text check (mode in ('voice', 'text'));
create index if not exists debriefs_application_idx on public.debriefs (application_id);

-- No reply is set automatically 30 days after sending (Build pack section 4).
-- Called by the scheduled job with the service role only.
create or replace function public.mark_silent_applications(p_days int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  with silent as (
    update public.applications a
       set status = 'no_response', next_check_in_at = null, updated_at = now()
     where a.status = 'sent'
       and a.sent_at is not null
       and a.sent_at < now() - make_interval(days => p_days)
    returning a.id, a.user_id
  ), events as (
    insert into public.outcome_events (application_id, user_id, from_status, to_status, source)
    select id, user_id, 'sent', 'no_response', 'auto_30d' from silent
    returning 1
  )
  select count(*) into n from events;
  return n;
end $$;
revoke all on function public.mark_silent_applications(int) from public, anon, authenticated;
grant execute on function public.mark_silent_applications(int) to service_role;

-- Shortlist mode: one session per application.
create unique index if not exists shortlist_one_per_application on public.shortlist_sessions (application_id);

-- Payments ------------------------------------------------------------------
-- An interview boost unlocks Shortlist mode for one invite, so it points at it.
alter table public.passes add column if not exists application_id uuid references public.applications (id) on delete set null;
alter table public.passes add column if not exists channel text;
alter table public.passes add column if not exists verified_at timestamptz;
alter table public.passes add column if not exists updated_at timestamptz not null default now();
create index if not exists passes_user_idx on public.passes (user_id, status);

-- Every Paystack webhook we accept, once. The unique key makes a repeated webhook a
-- no op. Service role only: no policies, so nobody else can read or write it.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  event text not null,
  payload_sha256 text not null,
  received_at timestamptz not null default now(),
  unique (reference, event)
);
alter table public.payment_events enable row level security;

-- Activates a pass exactly once, after the webhook signature and the amount have been
-- checked in code. Returns true only for the call that made the change.
create or replace function public.activate_pass(p_reference text, p_amount_kobo int, p_channel text, p_days int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.passes;
  base timestamptz;
begin
  select * into p from public.passes where paystack_reference = p_reference for update;
  if not found or p.status <> 'pending' or p.amount_kobo <> p_amount_kobo then
    return false;
  end if;
  if p.type = 'job_hunt_30d' then
    -- A new pass bought before the old one ends starts when the old one ends.
    select greatest(now(), coalesce(max(ends_at), now())) into base
      from public.passes where user_id = p.user_id and status = 'active' and type = 'job_hunt_30d';
    update public.passes
       set status = 'active', channel = p_channel, verified_at = now(), starts_at = base,
           ends_at = base + make_interval(days => p_days), updated_at = now()
     where id = p.id;
  else
    update public.passes
       set status = 'active', channel = p_channel, verified_at = now(), starts_at = now(), updated_at = now()
     where id = p.id;
  end if;
  return true;
end $$;
revoke all on function public.activate_pass(text, int, text, int) from public, anon, authenticated;
grant execute on function public.activate_pass(text, int, text, int) to service_role;
