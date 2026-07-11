-- Add durable, reviewable bean identity candidates without mutating coffee_catalog rows.
-- Identity truth stays in auditable links and append-only events until a future merged view exists.

create extension if not exists pgcrypto;

create table if not exists public.bean_identities (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'candidate'
    check (status in ('candidate', 'accepted', 'rejected', 'superseded')),
  canonical_name text,
  primary_catalog_id integer references public.coffee_catalog(id) on delete set null,
  superseded_by uuid references public.bean_identities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (superseded_by is null or superseded_by <> id)
);

create table if not exists public.bean_identity_links (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.bean_identities(id) on delete cascade,
  coffee_catalog_id integer not null references public.coffee_catalog(id) on delete cascade,
  status text not null default 'candidate'
    check (status in ('candidate', 'accepted', 'rejected', 'superseded')),
  active boolean not null default true,
  classifier_version text,
  dimension_scores jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  proof_summary_snapshot jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  proposed_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  superseded_by uuid references public.bean_identity_links(id) on delete set null,
  proposed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (superseded_by is null or superseded_by <> id)
);

create table if not exists public.bean_identity_events (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid references public.bean_identities(id) on delete set null,
  link_id uuid references public.bean_identity_links(id) on delete set null,
  action text not null check (action in ('create', 'accept', 'reject', 'supersede', 'merge', 'split', 'note')),
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bean_identities_status_idx
  on public.bean_identities(status);

create index if not exists bean_identity_links_identity_idx
  on public.bean_identity_links(identity_id);

create index if not exists bean_identity_links_catalog_idx
  on public.bean_identity_links(coffee_catalog_id);

create index if not exists bean_identity_links_status_idx
  on public.bean_identity_links(status);

create index if not exists bean_identity_events_identity_created_idx
  on public.bean_identity_events(identity_id, created_at desc);

create index if not exists bean_identity_events_link_created_idx
  on public.bean_identity_events(link_id, created_at desc);

alter table public.bean_identities enable row level security;
alter table public.bean_identity_links enable row level security;
alter table public.bean_identity_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bean_identities'
      and policyname = 'Service role full access for bean identities'
  ) then
    create policy "Service role full access for bean identities"
    on public.bean_identities for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bean_identity_links'
      and policyname = 'Service role full access for bean identity links'
  ) then
    create policy "Service role full access for bean identity links"
    on public.bean_identity_links for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bean_identity_events'
      and policyname = 'Service role full access for bean identity events'
  ) then
    create policy "Service role full access for bean identity events"
    on public.bean_identity_events for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end
$$;

-- A catalog row may participate in many historical candidates and rejections, but only one
-- currently active accepted identity link may exist at a time.
create unique index if not exists bean_identity_links_one_active_accepted_per_catalog_idx
  on public.bean_identity_links(coffee_catalog_id)
  where status = 'accepted' and active = true;

-- Prevent duplicate simultaneously-active links for the same identity/catalog pair while still
-- allowing historical rejected or superseded records to remain auditable.
create unique index if not exists bean_identity_links_one_active_link_per_identity_catalog_idx
  on public.bean_identity_links(identity_id, coffee_catalog_id)
  where active = true;

create or replace function public.set_bean_identity_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_bean_identities_updated_at on public.bean_identities;
create trigger set_bean_identities_updated_at
  before update on public.bean_identities
  for each row execute function public.set_bean_identity_updated_at();

drop trigger if exists set_bean_identity_links_updated_at on public.bean_identity_links;
create trigger set_bean_identity_links_updated_at
  before update on public.bean_identity_links
  for each row execute function public.set_bean_identity_updated_at();

create or replace function public.prevent_bean_identity_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'bean_identity_events are append-only';
end;
$$;

drop trigger if exists prevent_bean_identity_event_update on public.bean_identity_events;
create trigger prevent_bean_identity_event_update
  before update on public.bean_identity_events
  for each row execute function public.prevent_bean_identity_event_mutation();

drop trigger if exists prevent_bean_identity_event_delete on public.bean_identity_events;
create trigger prevent_bean_identity_event_delete
  before delete on public.bean_identity_events
  for each row execute function public.prevent_bean_identity_event_mutation();
