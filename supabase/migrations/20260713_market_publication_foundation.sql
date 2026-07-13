-- Additive provenance and cohort storage only.
-- This migration deliberately contains no publication, aggregate, reader, or
-- activation primitive. Legacy snapshot readers and writers remain unchanged.

create extension if not exists btree_gist;

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  command text not null check (length(btrim(command)) > 0),
  code_revision text,
  publication_scope text not null default 'non-production'
    check (publication_scope in ('production', 'non-production')),
  requested_source_count integer not null default 0 check (requested_source_count >= 0),
  selected_source_count integer not null default 0
    check (selected_source_count >= 0 and selected_source_count <= requested_source_count),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'degraded', 'failed', 'cancelled', 'legacy')),
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at),
  check ((status = 'running') = (completed_at is null))
);

-- One supplier may be captured by only one live scrape run at a time. The
-- monotonic fence prevents an expired worker from sealing a newer worker's set.
create table public.supplier_scrape_leases (
  source text primary key check (length(btrim(source)) > 0 and source = btrim(source)),
  scrape_run_id uuid not null references public.scrape_runs(id) on delete restrict,
  fence bigint not null check (fence > 0),
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > acquired_at)
);
create sequence public.supplier_scrape_lease_fence_seq;

create table public.supplier_observation_sets (
  id uuid primary key default gen_random_uuid(),
  scrape_run_id uuid references public.scrape_runs(id) on delete restrict,
  lease_fence bigint check (lease_fence is null or lease_fence > 0),
  source text not null check (length(btrim(source)) > 0 and source = btrim(source)),
  observed_at timestamptz not null,
  status text not null check (status in ('complete', 'partial', 'failed', 'skipped', 'unknown', 'legacy')),
  completeness text not null default 'known' check (completeness in ('known', 'unknown', 'legacy')),
  expected_item_count integer check (expected_item_count is null or expected_item_count >= 0),
  observed_item_count integer not null default 0 check (observed_item_count >= 0),
  snapshot_item_count integer not null default 0 check (snapshot_item_count >= 0),
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (scrape_run_id, source),
  unique (id, source),
  check (not is_complete or status in ('complete', 'legacy')),
  check (status <> 'complete' or is_complete),
  check (completeness <> 'known' or expected_item_count is not null)
);

create table public.coffee_price_observations (
  id bigint generated always as identity primary key,
  observation_set_id uuid not null,
  catalog_id integer not null references public.coffee_catalog(id) on delete restrict,
  source text not null check (length(btrim(source)) > 0 and source = btrim(source)),
  observed_at timestamptz not null,
  price numeric(12, 4) check (price is null or price >= 0),
  price_tiers jsonb,
  stocked boolean,
  wholesale boolean,
  origin text,
  process text,
  grade text,
  created_at timestamptz not null default now(),
  unique (observation_set_id, catalog_id),
  foreign key (observation_set_id, source)
    references public.supplier_observation_sets(id, source) on delete restrict,
  check (price_tiers is null or jsonb_typeof(price_tiers) = 'array')
);

create table public.market_index_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null check (length(btrim(cohort_key)) > 0),
  version integer not null check (version > 0),
  methodology_version text not null check (length(btrim(methodology_version)) > 0),
  description text,
  effective_from date not null,
  -- Exclusive. Retire v1 at the same boundary where v2 begins.
  effective_to date,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cohort_key, version),
  exclude using gist (
    cohort_key with =,
    daterange(effective_from, effective_to, '[)') with &&
  ),
  check (effective_to is null or effective_to > effective_from)
);

create table public.market_index_cohort_sources (
  cohort_id uuid not null references public.market_index_cohorts(id) on delete restrict,
  source text not null check (length(btrim(source)) > 0 and source = btrim(source)),
  source_weight numeric(12, 6) not null default 1 check (source_weight > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (cohort_id, source)
);

-- Cardinality is always derived from membership, never copied into cohort rows.
create view public.market_index_cohort_enabled_counts as
select cohort.id as cohort_id, count(source.source)::integer as enabled_source_count
from public.market_index_cohorts cohort
left join public.market_index_cohort_sources source
  on source.cohort_id = cohort.id and source.enabled
group by cohort.id;

create or replace function public.guard_scrape_run_lifecycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Scrape runs are immutable audit records'; end if;
  if new.id <> old.id or new.command <> old.command
    or new.code_revision is distinct from old.code_revision
    or new.publication_scope <> old.publication_scope
    or new.requested_source_count <> old.requested_source_count
    or new.selected_source_count <> old.selected_source_count
    or new.started_at <> old.started_at or new.created_at <> old.created_at then
    raise exception 'Scrape run identity, scope, selection, and start metadata are immutable';
  end if;
  if old.status <> 'running' then
    raise exception 'Terminal scrape runs cannot be reopened or relabeled';
  end if;
  if new.status = 'running' then
    if new.completed_at is not null then raise exception 'Running scrape run cannot be completed'; end if;
    return new;
  end if;
  if new.completed_at is null then raise exception 'Terminal scrape run requires completed_at'; end if;
  return new;
end $$;
create trigger guard_scrape_run_lifecycle before update or delete on public.scrape_runs
  for each row execute function public.guard_scrape_run_lifecycle();

create or replace function public.acquire_supplier_scrape_lease(
  p_source text,
  p_scrape_run_id uuid,
  p_ttl interval default interval '6 hours'
) returns bigint language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
  v_fence bigint;
begin
  if p_source is null or p_source = '' or p_source <> btrim(p_source) then
    raise exception 'source must be a non-empty canonical source key';
  end if;
  if p_scrape_run_id is null then raise exception 'scrape_run_id is required'; end if;
  if p_ttl is null or p_ttl <= interval '0 seconds' then
    raise exception 'lease TTL must be greater than zero';
  end if;

  perform 1 from public.scrape_runs run
  where run.id = p_scrape_run_id and run.status = 'running' and run.completed_at is null
  for update;
  if not found then raise exception 'supplier scrape leases require a running scrape run'; end if;

  insert into public.supplier_scrape_leases(source, scrape_run_id, fence, acquired_at, expires_at)
  values (p_source, p_scrape_run_id, nextval('public.supplier_scrape_lease_fence_seq'), v_now, v_now + p_ttl)
  on conflict (source) do update
  set scrape_run_id = excluded.scrape_run_id,
      fence = case
        when public.supplier_scrape_leases.scrape_run_id = excluded.scrape_run_id
          and public.supplier_scrape_leases.expires_at > v_now
          then public.supplier_scrape_leases.fence
        else excluded.fence
      end,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where public.supplier_scrape_leases.expires_at <= v_now
     or public.supplier_scrape_leases.scrape_run_id = excluded.scrape_run_id
     -- Terminal runs can never seal observations again, so their unexpired
     -- leases no longer represent live ownership. Reclaiming still consumes a
     -- new sequence fence, which keeps the abandoned worker fenced out.
     or not exists (
       select 1 from public.scrape_runs owner_run
       where owner_run.id = public.supplier_scrape_leases.scrape_run_id
         and owner_run.status = 'running'
         and owner_run.completed_at is null
     )
  returning public.supplier_scrape_leases.fence into v_fence;
  return v_fence;
end $$;

create or replace function public.release_supplier_scrape_lease(
  p_source text,
  p_scrape_run_id uuid,
  p_fence bigint
) returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if p_source is null or p_source = '' or p_source <> btrim(p_source) then
    raise exception 'source must be a non-empty canonical source key';
  end if;
  if p_scrape_run_id is null then raise exception 'scrape_run_id is required'; end if;
  if p_fence is null or p_fence <= 0 then raise exception 'lease fence is required'; end if;
  delete from public.supplier_scrape_leases lease
  where lease.source = p_source and lease.scrape_run_id = p_scrape_run_id and lease.fence = p_fence;
  return found;
end $$;

create or replace function public.guard_observation_artifact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_set_id uuid; v_complete boolean; v_parent_observed_at timestamptz;
begin
  for v_set_id in
    select distinct id from unnest(array[
      case when tg_op <> 'INSERT' then old.observation_set_id end,
      case when tg_op <> 'DELETE' then new.observation_set_id end
    ]) id where id is not null order by id
  loop
    select is_complete, observed_at into strict v_complete, v_parent_observed_at
    from public.supplier_observation_sets where id = v_set_id for update;
    if v_complete then raise exception 'Complete supplier observation sets are immutable'; end if;
    if tg_op <> 'DELETE' and new.observation_set_id = v_set_id
      and new.observed_at <> v_parent_observed_at then
      raise exception 'Observation timestamp must equal its supplier observation set timestamp';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger guard_complete_observations before insert or update or delete on public.coffee_price_observations
  for each row execute function public.guard_observation_artifact();

create or replace function public.guard_observation_set_lifecycle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_observation_count bigint;
begin
  if tg_op = 'INSERT' then
    if new.is_complete or new.status = 'complete' then
      raise exception 'All observation sets must be inserted open';
    end if;
    return new;
  end if;
  if old.is_complete then raise exception 'Complete supplier observation sets are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id or new.scrape_run_id is distinct from old.scrape_run_id
    or new.source <> old.source or new.observed_at <> old.observed_at
    or new.completeness <> old.completeness or new.lease_fence is distinct from old.lease_fence then
    raise exception 'Observation set identity, provenance, and lease fence are immutable';
  end if;
  if new.is_complete and new.status <> 'complete' then
    raise exception 'Completing an observation set requires complete status; completeness is separate';
  end if;
  if new.is_complete then
    if current_setting('app.sealing_supplier_observation_set', true) is distinct from new.id::text then
      raise exception 'Supplier observation sets may be completed only by seal_supplier_observation_set';
    end if;
    select count(*) into v_observation_count from public.coffee_price_observations observation
    where observation.observation_set_id = new.id;
    if v_observation_count = 0 then
      raise exception 'Zero-result supplier capture is a failure, not a complete observation set';
    end if;
    if v_observation_count <> new.observed_item_count
      or v_observation_count <> new.snapshot_item_count then
      raise exception 'Complete observation set counts must match stored observations and snapshot_item_count';
    end if;
    if new.completeness = 'known' and new.observed_item_count <> new.expected_item_count then
      raise exception 'Complete known observation set count must match expected_item_count';
    end if;
    if exists (select 1 from public.coffee_price_observations observation
      where observation.observation_set_id = new.id and observation.observed_at <> new.observed_at) then
      raise exception 'Observation set contains a child with a mismatched observation timestamp';
    end if;
  end if;
  return new;
end $$;
create trigger guard_observation_set_lifecycle before insert or update or delete on public.supplier_observation_sets
  for each row execute function public.guard_observation_set_lifecycle();

-- Canonical lock order for ingest finalization is run -> lease -> observation
-- set. Lease acquire/reacquire uses the same run -> lease prefix.
create or replace function public.seal_supplier_observation_set(
  p_observation_set_id uuid,
  p_lease_fence bigint,
  p_observed_item_count integer,
  p_snapshot_item_count integer
) returns public.supplier_observation_sets language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_unlocked_set public.supplier_observation_sets%rowtype;
  v_locked_set public.supplier_observation_sets%rowtype;
  v_lease public.supplier_scrape_leases%rowtype;
  v_observation_count bigint;
  v_result public.supplier_observation_sets%rowtype;
begin
  if p_observation_set_id is null then raise exception 'observation_set_id is required'; end if;
  if p_lease_fence is null or p_lease_fence <= 0 then raise exception 'lease fence is required'; end if;
  if p_observed_item_count is null or p_observed_item_count < 0
    or p_snapshot_item_count is null or p_snapshot_item_count < 0 then
    raise exception 'observation counts must be non-negative';
  end if;

  -- Identity fields are immutable, so this non-locking read safely discovers
  -- the run needed to start the canonical lock chain.
  select * into v_unlocked_set from public.supplier_observation_sets
  where id = p_observation_set_id;
  if not found then raise exception 'supplier observation set does not exist'; end if;
  if v_unlocked_set.scrape_run_id is null or v_unlocked_set.lease_fence is null then
    raise exception 'sealing requires run-owned fenced provenance';
  end if;

  perform 1 from public.scrape_runs run
  where run.id = v_unlocked_set.scrape_run_id and run.status = 'running' and run.completed_at is null
  for update;
  if not found then raise exception 'Observation sets cannot be sealed after their scrape run is terminal'; end if;

  select * into v_lease from public.supplier_scrape_leases lease
  where lease.source = v_unlocked_set.source for update;
  if not found or v_lease.scrape_run_id <> v_unlocked_set.scrape_run_id
    or v_lease.fence <> p_lease_fence or v_unlocked_set.lease_fence <> p_lease_fence
    or v_lease.expires_at <= clock_timestamp() then
    raise exception 'Completing an observation set requires its live fenced supplier lease';
  end if;

  select * into strict v_locked_set from public.supplier_observation_sets
  where id = p_observation_set_id for update;
  if v_locked_set.is_complete then raise exception 'Complete supplier observation sets are immutable'; end if;
  if v_locked_set.status <> 'partial' then
    raise exception 'Only partial supplier observation sets can be sealed';
  end if;
  if v_locked_set.scrape_run_id <> v_unlocked_set.scrape_run_id
    or v_locked_set.source <> v_unlocked_set.source
    or v_locked_set.lease_fence <> v_unlocked_set.lease_fence then
    raise exception 'supplier observation set provenance changed during sealing';
  end if;

  select count(*) into v_observation_count from public.coffee_price_observations observation
  where observation.observation_set_id = p_observation_set_id;
  if v_observation_count = 0 then
    raise exception 'Zero-result supplier capture is a failure, not a complete observation set';
  end if;
  if v_observation_count <> p_observed_item_count
    or v_observation_count <> p_snapshot_item_count then
    raise exception 'Complete observation set counts must match stored observations and snapshot_item_count';
  end if;
  if v_locked_set.completeness = 'known'
    and p_observed_item_count <> v_locked_set.expected_item_count then
    raise exception 'Complete known observation set count must match expected_item_count';
  end if;
  if exists (select 1 from public.coffee_price_observations observation
    where observation.observation_set_id = p_observation_set_id
      and observation.observed_at <> v_locked_set.observed_at) then
    raise exception 'Observation set contains a child with a mismatched observation timestamp';
  end if;

  perform set_config('app.sealing_supplier_observation_set', p_observation_set_id::text, true);
  update public.supplier_observation_sets
  set status = 'complete', is_complete = true,
      observed_item_count = p_observed_item_count,
      snapshot_item_count = p_snapshot_item_count
  where id = p_observation_set_id
  returning * into v_result;
  perform set_config('app.sealing_supplier_observation_set', '', true);
  return v_result;
end $$;

-- Freezing is an ingest/configuration boundary only. Later publication tables
-- must freeze a cohort in the same transaction before referencing it.
create or replace function public.freeze_market_index_cohort(p_cohort_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_enabled_count integer;
begin
  perform 1 from public.market_index_cohorts where id = p_cohort_id for update;
  if not found then
    raise exception 'market index cohort does not exist';
  end if;
  select count(*)::integer into v_enabled_count
  from public.market_index_cohort_sources where cohort_id = p_cohort_id and enabled;
  if v_enabled_count = 0 then raise exception 'cannot freeze an empty market index cohort'; end if;
  update public.market_index_cohorts set frozen_at = coalesce(frozen_at, clock_timestamp())
  where id = p_cohort_id;
  return v_enabled_count;
end $$;

create or replace function public.guard_market_cohort_sources()
returns trigger language plpgsql set search_path = public as $$
declare v_cohort_id uuid;
begin
  for v_cohort_id in select distinct id from unnest(array[
    case when tg_op <> 'INSERT' then old.cohort_id end,
    case when tg_op <> 'DELETE' then new.cohort_id end
  ]) id where id is not null order by id
  loop
    perform 1 from public.market_index_cohorts where id = v_cohort_id and frozen_at is null for update;
    if not found then raise exception 'Frozen market cohort membership is immutable; create a successor version'; end if;
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger guard_market_cohort_sources before insert or update or delete on public.market_index_cohort_sources
  for each row execute function public.guard_market_cohort_sources();

create or replace function public.guard_market_cohort_definition()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.frozen_at is not null then
      raise exception 'Market cohorts must be inserted unfrozen; use the freeze RPC after adding sources';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.frozen_at is not null then raise exception 'Frozen market cohort is immutable'; end if;
    return old;
  end if;
  if old.frozen_at is not null then
    if new.id <> old.id or new.cohort_key <> old.cohort_key or new.version <> old.version
      or new.methodology_version <> old.methodology_version
      or new.description is distinct from old.description or new.effective_from <> old.effective_from
      or new.frozen_at is distinct from old.frozen_at or new.created_at <> old.created_at then
      raise exception 'Frozen market cohort definition is immutable; create a successor version';
    end if;
    if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
      raise exception 'Retired market cohort boundary is immutable';
    end if;
  end if;
  return new;
end $$;
create trigger guard_market_cohort_definition before insert or update or delete on public.market_index_cohorts
  for each row execute function public.guard_market_cohort_definition();

create index supplier_observation_sets_source_observed
  on public.supplier_observation_sets (source, observed_at desc) where is_complete;
create index coffee_price_observations_set on public.coffee_price_observations (observation_set_id);

comment on table public.scrape_runs is
  'Operational scrape invocation identity. publication_scope distinguishes canonical production all-runs from recovery, test, source, group, and backfill runs.';
comment on table public.supplier_scrape_leases is
  'Fenced ingest ownership. Leases protect observation sealing and do not authorize publication.';
comment on table public.supplier_observation_sets is
  'Immutable supplier-level observation identity. A zero-result scrape remains failed or partial and never erases the last known good set.';
comment on table public.coffee_price_observations is
  'True-time observations. Later carry-forward references these rows without fabricating a new observation date.';
comment on table public.market_index_cohorts is
  'Explicit versioned market cohort. Enabled cardinality is derived from membership; effective_to is an exclusive retirement boundary.';
comment on table public.market_index_cohort_sources is
  'Versioned cohort membership and supplier influence. No short carry-forward TTL is stored here.';

do $$ declare t text; begin
  foreach t in array array['scrape_runs','coffee_price_observations','market_index_cohorts','market_index_cohort_sources'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'Service role only ' || t, t);
  end loop;
end $$;
-- The service role may retire or revise an unfrozen cohort, but only the
-- security-definer freeze RPC may set frozen_at after validating membership.
revoke update on table public.market_index_cohorts from service_role;
grant update (cohort_key, version, methodology_version, description, effective_from, effective_to)
  on table public.market_index_cohorts to service_role;
alter table public.supplier_observation_sets enable row level security;
revoke all on table public.supplier_observation_sets from public, anon, authenticated, service_role;
grant select, insert on table public.supplier_observation_sets to service_role;
create policy "Service role reads supplier_observation_sets" on public.supplier_observation_sets
  for select using (auth.role() = 'service_role');
create policy "Service role inserts supplier_observation_sets" on public.supplier_observation_sets
  for insert with check (auth.role() = 'service_role');
alter table public.supplier_scrape_leases enable row level security;
revoke all on table public.supplier_scrape_leases from public, anon, authenticated, service_role;
grant select on table public.supplier_scrape_leases to service_role;
create policy "Service role reads supplier_scrape_leases" on public.supplier_scrape_leases
  for select using (auth.role() = 'service_role');
revoke all on public.market_index_cohort_enabled_counts from public, anon, authenticated;
grant select on public.market_index_cohort_enabled_counts to service_role;
revoke all on function public.acquire_supplier_scrape_lease(text, uuid, interval) from public, anon, authenticated;
grant execute on function public.acquire_supplier_scrape_lease(text, uuid, interval) to service_role;
revoke all on function public.release_supplier_scrape_lease(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.release_supplier_scrape_lease(text, uuid, bigint) to service_role;
revoke all on function public.seal_supplier_observation_set(uuid, bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.seal_supplier_observation_set(uuid, bigint, integer, integer) to service_role;
revoke all on function public.freeze_market_index_cohort(uuid) from public, anon, authenticated;
grant execute on function public.freeze_market_index_cohort(uuid) to service_role;
revoke all on function public.guard_observation_artifact() from public, anon, authenticated;
revoke all on function public.guard_scrape_run_lifecycle() from public, anon, authenticated;
revoke all on function public.guard_observation_set_lifecycle() from public, anon, authenticated;
revoke all on function public.guard_market_cohort_sources() from public, anon, authenticated;
revoke all on function public.guard_market_cohort_definition() from public, anon, authenticated;
grant usage, select on sequence public.coffee_price_observations_id_seq to service_role;
