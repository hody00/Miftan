begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'retention@example.com');
insert into public.sources (id, owner_id, kind, source_url, display_name)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'group', 'https://example.com/group', 'fixture');
insert into public.posts (id, owner_id, source_id, provider, external_post_id, canonical_url, published_at)
values
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'facebook', 'boundary', 'https://example.com/1', now() - interval '6 months'),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'facebook', 'expired', 'https://example.com/2', now() - interval '6 months' - interval '1 microsecond');
insert into public.listings (owner_id, post_id) select owner_id, id from public.posts where owner_id = '00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.posts), 1::bigint, 'exact calendar cutoff remains visible');
select is((select external_post_id from public.posts), 'boundary', 'one microsecond before cutoff is excluded');
select is((select count(*) from public.listings), 1::bigint, 'listing retention follows its post');
select is((select price_ils from public.listings), null::numeric, 'unknown price stays null');
select throws_ok($$update public.sources set enabled = true$$, '23514', null, 'collection cannot be enabled');
select * from finish();
rollback;
