-- Notifications: what shows in the Updates panel behind the bell.
-- Personal notifications (payment confirmed, pass ending, a message to one person) are
-- written only by the service role. Announcements go to everyone (or one audience) from
-- the back office. People can read their own and mark them read, nothing else.

create type public.notification_kind as enum ('message', 'payment', 'pass', 'trial', 'application', 'system');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 600),
  -- Only links inside the app, never to another site.
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.#-]*$'),
  -- Stops the same reminder twice, for example 'pass_ending:<pass id>'.
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- People may only change read_at.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 600),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.#-]*$'),
  audience text not null default 'everyone' check (audience in ('everyone', 'trial', 'pass', 'no_pass')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_live_idx on public.announcements (starts_at desc);
alter table public.announcements enable row level security;
create policy announcements_read_live on public.announcements for select to authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now()));
revoke insert, update, delete on public.announcements from anon, authenticated;

create table public.announcement_reads (
  user_id uuid not null references public.users (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
alter table public.announcement_reads enable row level security;
create policy announcement_reads_select_own on public.announcement_reads for select to authenticated using (user_id = (select auth.uid()));
create policy announcement_reads_insert_own on public.announcement_reads for insert to authenticated with check (user_id = (select auth.uid()));
