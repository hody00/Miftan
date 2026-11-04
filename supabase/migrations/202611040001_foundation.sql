-- Private user data. No collector or public dataset is enabled in milestone 1.
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'facebook' check (length(provider) between 1 and 40),
  kind text not null check (kind in ('group', 'page')),
  source_url text not null check (source_url ~ '^https://'),
  display_name text not null check (length(display_name) between 1 and 200),
  enabled boolean not null default false check (enabled = false),
  authorization_status text not null default 'unverified' check (authorization_status in ('unverified', 'authorized', 'revoked')),
  created_at timestamptz not null default now(),
  unique (owner_id, id, provider),
  unique (owner_id, provider, source_url)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  provider text not null,
  external_post_id text not null check (length(external_post_id) between 1 and 500),
  canonical_url text not null check (canonical_url ~ '^https://'),
  published_at timestamptz not null,
  collected_at timestamptz not null default now(),
  body text not null default '',
  comments jsonb not null default '[]'::jsonb check (jsonb_typeof(comments) = 'array'),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  unique (owner_id, id),
  unique (owner_id, provider, external_post_id),
  foreign key (owner_id, source_id, provider) references public.sources(owner_id, id, provider) on delete cascade
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null,
  listing_type text not null default 'unknown' check (listing_type in ('rental', 'sale', 'unknown')),
  city text,
  neighborhood text,
  price_ils numeric(14,2) check (price_ils >= 0),
  rooms numeric(4,1) check (rooms > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, post_id),
  foreign key (owner_id, post_id) references public.posts(owner_id, id) on delete cascade
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  storage_path text not null unique,
  display_order integer not null default 0 check (display_order >= 0),
  check (split_part(storage_path, '/', 1) = owner_id::text),
  check (storage_path !~ '(^|/)\.\.(/|$)'),
  foreign key (owner_id, listing_id) references public.listings(owner_id, id) on delete cascade
);

create index posts_owner_published_idx on public.posts(owner_id, published_at desc);
create index posts_source_idx on public.posts(owner_id, source_id, provider);
create index listings_owner_location_idx on public.listings(owner_id, city, neighborhood);
create index listings_owner_price_idx on public.listings(owner_id, price_ils);
create index listings_owner_rooms_idx on public.listings(owner_id, rooms);
create index listings_owner_type_idx on public.listings(owner_id, listing_type);
create index images_owner_listing_idx on public.listing_images(owner_id, listing_id, display_order);

alter table public.sources enable row level security;
alter table public.posts enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

revoke all on public.sources, public.posts, public.listings, public.listing_images from anon;
grant select, insert, update, delete on public.sources, public.posts, public.listings, public.listing_images to authenticated;
grant all on public.sources, public.posts, public.listings, public.listing_images to service_role;

create policy sources_owner on public.sources for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Retention is enforced in the data layer, including indirect listing/image reads.
-- Unknown dates must be resolved before ingestion; they are never replaced with collected_at.
create policy posts_read on public.posts for select to authenticated using (
  owner_id = (select auth.uid()) and published_at >= now() - interval '6 months'
);
create policy posts_insert on public.posts for insert to authenticated with check (owner_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using (owner_id = (select auth.uid()));

create policy listings_read on public.listings for select to authenticated using (
  owner_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id and p.owner_id = listings.owner_id)
);
create policy listings_insert on public.listings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy listings_update on public.listings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy listings_delete on public.listings for delete to authenticated using (owner_id = (select auth.uid()));

create policy images_read on public.listing_images for select to authenticated using (
  owner_id = (select auth.uid()) and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = listing_images.owner_id)
);
create policy images_insert on public.listing_images for insert to authenticated with check (owner_id = (select auth.uid()));
create policy images_update on public.listing_images for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy images_delete on public.listing_images for delete to authenticated using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

-- Create image metadata before uploading. Reading requires a non-expired listing.
create policy listing_images_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.listing_images i where i.storage_path = name and i.owner_id = (select auth.uid()))
);
create policy listing_images_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.listing_images i where i.storage_path = name and i.owner_id = (select auth.uid()))
);
create policy listing_images_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.listing_images i where i.storage_path = name and i.owner_id = (select auth.uid()))
);
create policy listing_images_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
