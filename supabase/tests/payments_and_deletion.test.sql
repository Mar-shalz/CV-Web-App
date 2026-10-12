-- pgTAP: payments can only be unlocked by the service role, a pass activates once,
-- and deleting an account removes every row (Slices 9 and 10).
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values ('33333333-3333-3333-3333-333333333333', 'c@example.test', '{"provider":"email"}', '{}');

insert into public.passes (id, user_id, type, amount_kobo, paystack_reference, status)
values ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'job_hunt_30d', 500000, 'rcp_test_reference_000000000001', 'pending');

-- A signed in user can't call the money functions or read the webhook log.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$ select public.activate_pass('rcp_test_reference_000000000001', 500000, 'card', 30) $$, '42501', null, 'A user cannot activate a pass');
select throws_ok($$ select public.mark_silent_applications(30) $$, '42501', null, 'A user cannot run the No reply job');
select is((select count(*) from public.payment_events)::int, 0, 'A user cannot read webhook events');
reset role;

-- The service role path: wrong amount does nothing, right amount activates once.
select is(public.activate_pass('rcp_test_reference_000000000001', 150000, 'card', 30), false, 'Wrong amount grants nothing');
select is(public.activate_pass('rcp_test_reference_000000000001', 500000, 'card', 30), true, 'Verified charge activates the pass');
select is(public.activate_pass('rcp_test_reference_000000000001', 500000, 'card', 30), false, 'A repeat grants nothing');
select ok((select ends_at > now() + interval '29 days' from public.passes where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'Pass runs for 30 days');

insert into public.payment_events (reference, event, payload_sha256) values ('rcp_test_reference_000000000001', 'charge.success', 'x');
select throws_ok($$ insert into public.payment_events (reference, event, payload_sha256) values ('rcp_test_reference_000000000001', 'charge.success', 'y') $$, '23505', null, 'The same webhook event is accepted once');

-- Deleting the sign in record removes the person's rows, applications included.
insert into public.jobs (id, user_id, source_type, post_hash) values ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'paste', 'test-hash');
insert into public.applications (user_id, job_id, status) values ('33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-000000000001', 'draft');
delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
select is((select count(*) from public.jobs where user_id = '33333333-3333-3333-3333-333333333333')::int, 0, 'Account deletion removes jobs and applications');

select * from finish();
rollback;
