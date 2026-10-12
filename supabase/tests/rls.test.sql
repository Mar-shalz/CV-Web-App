-- pgTAP: one user can't read or write another user's rows (Slice 0 "done when").
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Two auth users. The on_auth_user_created trigger creates their app rows.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test', '{"provider":"email"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test', '{"provider":"email"}', '{}');

insert into public.vault_roles (id, user_id, kind, organisation, source)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'job', 'Org B', 'text');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.users)::int, 1, 'A sees only their own users row');
select is((select count(*) from public.profiles)::int, 1, 'A sees only their own profile');
select is((select count(*) from public.vault_roles)::int, 0, 'A cannot read B''s vault roles');
select is((select count(*) from public.usage_counters)::int, 1, 'A sees only their own usage counter');

select throws_ok(
  $$ insert into public.vault_roles (user_id, kind, source) values ('22222222-2222-2222-2222-222222222222', 'job', 'text') $$,
  '42501', null, 'A cannot insert rows for B'
);

update public.vault_roles set organisation = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select is((select organisation from public.vault_roles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Org B', 'A cannot update B''s rows');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.passes (user_id, type, status) values ('11111111-1111-1111-1111-111111111111', 'job_hunt_30d', 'active') $$,
  '42501', null, 'A cannot grant themselves a pass'
);
select throws_ok(
  $$ update public.users set email = 'x@example.test' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'A cannot change their own email column'
);

select * from finish();
rollback;
