-- Transactional candidate construction and whole-publication promotion.
-- Cohort v1 is an explicit review of coffee-scraper sourceMap on 2026-07-13.

insert into public.market_index_cohorts
  (id, cohort_key, version, methodology_version, expected_source_count, description, effective_from)
values
  ('4f66f0c4-1475-4ca5-9a2d-202607130001', 'production', 1,
   'supplier-first-matched-relative-v1', 44,
   'Reviewed coffee-scraper production sourceMap at 2026-07-13; explicit membership, equal weights, three-day carry TTL.',
   date '2026-07-13')
on conflict (cohort_key, version) do nothing;

insert into public.market_index_cohort_sources (cohort_id, source, carry_forward_ttl, source_weight, enabled)
select '4f66f0c4-1475-4ca5-9a2d-202607130001', source, interval '3 days', 1, true
from unnest(array[
  'aida_batlle','ally_coffee','ally_open','atlas_coffee','bc_green_coffee','bodhi_leaf','burman',
  'cafe_imports','cafe_juan_ana','cafe_kreyol','captain_coffee','coffee_bean_corral',
  'coffee_bean_direct','coffee_crafters_green','coffee_project','coffee_shrub','copan_trade',
  'covoya','deans_beans','forest_coffee','fresh_roasted_coffee','genuine_origin',
  'good_brothers','hacea_coffee','happy_mug','home_roast_coffee','java_bean_plus','klatch',
  'lavanta_coffee','mill_city','prime_green_coffee','primos_coffee','rhoadsroast',
  'roastmasters','royal_coffee','sea_island','showroom_coffee','smokin_beans','sonofresco',
  'stonex_specialty','sweet_maria','theta_ridge','tm_ward_coffee','yellow_rooster'
]::text[]) source
on conflict (cohort_id, source) do nothing;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.market_index_cohort_sources
   where cohort_id = '4f66f0c4-1475-4ca5-9a2d-202607130001' and enabled;
  if v_count <> 44 then raise exception 'production cohort v1 expected 44 enabled sources, found %', v_count; end if;
end $$;

-- One supplier may be captured by only one live scrape run at a time. The
-- expiring lease recovers from crashed workers without requiring an operator
-- to fabricate or delete observation data.
create table public.supplier_scrape_leases (
  source text primary key check (length(btrim(source)) > 0 and source = btrim(source)),
  scrape_run_id uuid not null references public.scrape_runs(id) on delete restrict,
  fence bigint not null check (fence > 0),
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > acquired_at)
);
create sequence public.supplier_scrape_lease_fence_seq;

alter table public.supplier_observation_sets
  add column lease_fence bigint check (lease_fence is null or lease_fence > 0);

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
  if not found then
    raise exception 'supplier scrape leases require a running scrape run';
  end if;

  insert into public.supplier_scrape_leases(source,scrape_run_id,fence,acquired_at,expires_at)
  values (p_source,p_scrape_run_id,nextval('public.supplier_scrape_lease_fence_seq'),v_now,v_now+p_ttl)
  on conflict (source) do update
  set scrape_run_id=excluded.scrape_run_id,
      fence=case
        when public.supplier_scrape_leases.scrape_run_id=excluded.scrape_run_id
          then public.supplier_scrape_leases.fence
        else excluded.fence
      end,
      acquired_at=excluded.acquired_at,
      expires_at=excluded.expires_at
  where public.supplier_scrape_leases.expires_at <= v_now
     or public.supplier_scrape_leases.scrape_run_id = excluded.scrape_run_id
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

-- Child facts inherit the supplier set's true observation instant. This
-- replacement preserves the foundation's parent locking while rejecting
-- forged old/future child timestamps.
create or replace function public.guard_observation_artifact()
returns trigger language plpgsql set search_path = public as $$
declare
  v_set_id uuid;
  v_complete boolean;
  v_parent_observed_at timestamptz;
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

create or replace function public.guard_observation_set_lifecycle()
returns trigger language plpgsql set search_path = public as $$
declare
  v_lease public.supplier_scrape_leases%rowtype;
begin
  if old.is_complete then raise exception 'Complete supplier observation sets are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id or new.scrape_run_id is distinct from old.scrape_run_id
    or new.source <> old.source or new.observed_at <> old.observed_at
    or new.completeness <> old.completeness or new.lease_fence is distinct from old.lease_fence then
    raise exception 'Observation set identity, provenance, and lease fence are immutable';
  end if;
  if new.is_complete and new.status not in ('complete', 'legacy') then
    raise exception 'Completing an observation set requires complete or legacy status';
  end if;
  if new.is_complete and new.completeness = 'known' then
    if new.scrape_run_id is null or new.lease_fence is null then
      raise exception 'Completing a known observation set requires its scrape run and lease fence';
    end if;
    select * into v_lease from public.supplier_scrape_leases lease
    where lease.source = new.source for update;
    if not found or v_lease.scrape_run_id <> new.scrape_run_id
      or v_lease.fence <> new.lease_fence or v_lease.expires_at <= clock_timestamp() then
      raise exception 'Completing an observation set requires its live fenced supplier lease';
    end if;
    if exists (
      select 1 from public.coffee_price_observations observation
      where observation.observation_set_id = new.id
        and observation.observed_at <> new.observed_at
    ) then
      raise exception 'Observation set contains a child with a mismatched observation timestamp';
    end if;
  end if;
  return new;
end $$;

create table public.market_publication_quality_policies (
  policy_version text primary key check (length(btrim(policy_version)) > 0),
  effective_from date not null unique,
  effective_to date,
  expected_item_lookback interval not null default interval '30 days'
    check (expected_item_lookback > interval '0 seconds'),
  healthy_supplier_coverage numeric(8,6) not null check (healthy_supplier_coverage between 0 and 1),
  healthy_item_coverage numeric(8,6) not null check (healthy_item_coverage between 0 and 1),
  healthy_max_stale_share numeric(8,6) not null check (healthy_max_stale_share between 0 and 1),
  degraded_supplier_coverage numeric(8,6) not null check (degraded_supplier_coverage between 0 and 1),
  degraded_item_coverage numeric(8,6) not null check (degraded_item_coverage between 0 and 1),
  degraded_max_stale_share numeric(8,6) not null check (degraded_max_stale_share between 0 and 1),
  supplier_coverage_weight numeric(8,6) not null check (supplier_coverage_weight between 0 and 1),
  item_coverage_weight numeric(8,6) not null check (item_coverage_weight between 0 and 1),
  freshness_weight numeric(8,6) not null check (freshness_weight between 0 and 1),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (healthy_supplier_coverage >= degraded_supplier_coverage),
  check (healthy_item_coverage >= degraded_item_coverage),
  check (healthy_max_stale_share <= degraded_max_stale_share),
  check (supplier_coverage_weight + item_coverage_weight + freshness_weight = 1)
);

insert into public.market_publication_quality_policies (
  policy_version, effective_from, expected_item_lookback,
  healthy_supplier_coverage, healthy_item_coverage, healthy_max_stale_share,
  degraded_supplier_coverage, degraded_item_coverage, degraded_max_stale_share,
  supplier_coverage_weight, item_coverage_weight, freshness_weight
) values (
  'coverage-v1', date '1970-01-01', interval '30 days',
  0.80, 0.70, 0.20,
  0.60, 0.50, 0.40,
  0.45, 0.35, 0.20
);

alter table public.market_publications
  add constraint market_publications_policy_version_fkey
  foreign key (policy_version) references public.market_publication_quality_policies(policy_version) on delete restrict;
alter table public.market_publications
  add column predecessor_publication_id uuid references public.market_publications(id) on delete restrict;

create or replace function public.guard_market_publication_predecessor()
returns trigger language plpgsql set search_path = public as $$
declare
  v_predecessor public.market_publications%rowtype;
begin
  if tg_op = 'UPDATE' and new.predecessor_publication_id is distinct from old.predecessor_publication_id then
    raise exception 'Publication predecessor is immutable';
  end if;
  if new.predecessor_publication_id is not null then
    select * into strict v_predecessor from public.market_publications
    where id = new.predecessor_publication_id for share;
    if v_predecessor.cohort_id <> new.cohort_id or v_predecessor.as_of_date >= new.as_of_date
      or v_predecessor.status <> 'active' then
      raise exception 'Publication predecessor must be an earlier active publication in the same cohort';
    end if;
  end if;
  return new;
end $$;
create trigger guard_market_publication_predecessor
  before insert or update on public.market_publications
  for each row execute function public.guard_market_publication_predecessor();

create or replace function public.guard_market_publication_quality_policy()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.market_publications publication
    where publication.policy_version = old.policy_version
  ) then
    raise exception 'Referenced market publication policy is immutable; create a new policy version';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger guard_market_publication_quality_policy
  before update or delete on public.market_publication_quality_policies
  for each row execute function public.guard_market_publication_quality_policy();

create table public.market_publication_source_evidence (
  publication_id uuid not null references public.market_publications(id) on delete restrict,
  source text not null,
  expected_item_count integer not null check (expected_item_count >= 0),
  represented_item_count integer not null check (represented_item_count >= 0),
  source_weight numeric(12,6) not null check (source_weight > 0),
  selection_state text not null check (selection_state in ('fresh','carried','expired','missing')),
  observed_at timestamptz,
  observation_age interval check (observation_age is null or observation_age >= interval '0 seconds'),
  primary key (publication_id, source)
);

create table public.market_publication_supplier_segments (
  id bigint generated always as identity primary key,
  publication_id uuid not null references public.market_publications(id) on delete restrict,
  source text not null,
  origin text not null,
  process text,
  grade text,
  wholesale_only boolean not null,
  source_weight numeric(12,6) not null check (source_weight > 0),
  item_count integer not null check (item_count > 0),
  source_price_median numeric(12,4) not null check (source_price_median >= 0)
);
create unique index market_publication_supplier_segments_key on public.market_publication_supplier_segments
  (publication_id, source, origin, coalesce(process,''), coalesce(grade,''), wholesale_only);

create table public.market_publication_movements (
  id bigint generated always as identity primary key,
  publication_id uuid not null references public.market_publications(id) on delete restrict,
  origin text not null,
  process text,
  grade text,
  wholesale_only boolean not null,
  prior_publication_id uuid references public.market_publications(id) on delete restrict,
  matched_supplier_count integer not null check (matched_supplier_count >= 0),
  matched_weight numeric(14,6) not null check (matched_weight >= 0),
  current_weight numeric(14,6) not null check (current_weight >= 0),
  prior_weight numeric(14,6) not null check (prior_weight >= 0),
  matched_weight_ratio numeric(8,6) check (matched_weight_ratio between 0 and 1),
  total_price_relative numeric(14,8),
  matched_price_relative numeric(14,8),
  movement_pct numeric(14,8),
  assortment_shift_pct numeric(14,8),
  movement_status text not null check (movement_status in ('publishable','insufficient_overlap','no_prior'))
);
create unique index market_publication_movements_key on public.market_publication_movements
  (publication_id, origin, coalesce(process,''), coalesce(grade,''), wholesale_only);

-- Builder-only tables obey the same publication lock and immutability contract.
create trigger guard_market_publication_source_evidence before insert or update or delete on public.market_publication_source_evidence
  for each row execute function public.guard_market_publication_artifact();
create trigger guard_market_publication_supplier_segments before insert or update or delete on public.market_publication_supplier_segments
  for each row execute function public.guard_market_publication_artifact();
create trigger guard_market_publication_movements before insert or update or delete on public.market_publication_movements
  for each row execute function public.guard_market_publication_artifact();

do $$ declare t text; begin
  foreach t in array array['supplier_scrape_leases','market_publication_quality_policies','market_publication_source_evidence','market_publication_supplier_segments','market_publication_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'Service role only ' || t, t);
  end loop;
end $$;

create or replace function public.market_weighted_percentile(p_values numeric[], p_weights numeric[], p_fraction numeric)
returns numeric language sql immutable strict set search_path = public, pg_temp as $$
  with points as (
    select v, w, sum(w) over (order by v, ord) cumulative_weight, sum(w) over () total_weight
    from unnest(p_values, p_weights) with ordinality as u(v,w,ord) where w > 0
  )
  select v from points where cumulative_weight >= total_weight*p_fraction order by v limit 1
$$;

create or replace function public.build_market_publication(
  p_as_of_date date,
  p_cohort_key text,
  p_cohort_version integer
) returns table (
  publication_id uuid,
  status text,
  quality_tier text,
  supplier_coverage_ratio numeric,
  item_coverage_ratio numeric,
  stale_share numeric,
  action text
) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_cohort public.market_index_cohorts%rowtype;
  v_policy public.market_publication_quality_policies%rowtype;
  v_pub uuid := gen_random_uuid();
  v_cutoff timestamptz := ((p_as_of_date + 1)::timestamp at time zone 'UTC');
  v_day_start timestamptz := (p_as_of_date::timestamp at time zone 'UTC');
  v_expected_items integer;
  v_represented_items integer;
  v_fresh_items integer;
  v_carried_items integer;
  v_represented_sources integer;
  v_fresh_sources integer;
  v_carried_sources integer;
  v_expired_sources integer;
  v_supplier_coverage numeric;
  v_item_coverage numeric;
  v_stale numeric;
  v_tier text;
  v_score numeric;
  v_old public.market_publications%rowtype;
  v_prior uuid;
  v_action text;
  v_enabled_source_count integer;
  v_had_old boolean;
  v_chain_finalized boolean;
begin
  if p_as_of_date is null or p_cohort_key is null or p_cohort_version is null then
    raise exception 'as_of_date, cohort_key, and cohort_version are required';
  end if;
  select * into strict v_cohort from public.market_index_cohorts
   where cohort_key=p_cohort_key and version=p_cohort_version
     and effective_from <= p_as_of_date and (effective_to is null or effective_to >= p_as_of_date)
   for update;
  perform 1 from public.market_index_cohort_sources cohort_source
  where cohort_source.cohort_id = v_cohort.id
  order by cohort_source.source for share;
  select count(*) into v_enabled_source_count
  from public.market_index_cohort_sources cohort_source
  where cohort_source.cohort_id = v_cohort.id and cohort_source.enabled;
  if v_enabled_source_count <> v_cohort.expected_source_count then
    raise exception 'Cohort expected_source_count (%) does not match enabled membership (%)',
      v_cohort.expected_source_count, v_enabled_source_count;
  end if;
  select * into strict v_policy
  from public.market_publication_quality_policies policy
  where policy.effective_from <= p_as_of_date
    and (policy.effective_to is null or policy.effective_to >= p_as_of_date)
  order by policy.effective_from desc
  limit 1
  for share;
  perform pg_advisory_xact_lock(hashtextextended(v_cohort.id::text || ':' || p_as_of_date::text, 0));
  select prior.id into v_prior from public.market_publications prior
  where prior.cohort_id=v_cohort.id and prior.status='active' and prior.as_of_date<p_as_of_date
  order by prior.as_of_date desc limit 1 for share;

  -- A caller may build more than one candidate in the same transaction.  Keep
  -- the scratch relation session-local, but replace its contents per call.
  if to_regclass('pg_temp._selected') is not null then
    execute 'drop table pg_temp._selected';
  end if;
  create temporary table _selected on commit drop as
  with members as (
    select cs.*, (
      select max(s.expected_item_count) from public.supplier_observation_sets s
       where s.source=cs.source and s.is_complete and s.status='complete' and s.completeness='known'
         and s.observed_at < v_cutoff and s.observed_at >= v_cutoff - v_policy.expected_item_lookback
    ) baseline, chosen.id, chosen.observed_at, chosen.expected_item_count, chosen.snapshot_item_count
    from public.market_index_cohort_sources cs
    left join lateral (
      select s.id, s.observed_at, s.expected_item_count, s.snapshot_item_count
      from public.supplier_observation_sets s
      where s.source=cs.source and s.is_complete and s.status='complete' and s.completeness='known'
        and s.observed_at < v_cutoff and s.observed_at >= v_cutoff-cs.carry_forward_ttl
      order by s.observed_at desc, s.id desc limit 1
    ) chosen on true
    where cs.cohort_id=v_cohort.id and cs.enabled
  )
  select source, carry_forward_ttl, source_weight,
    greatest(coalesce(baseline,0),coalesce(expected_item_count,0))::integer expected_items,
    id observation_set_id, observed_at, coalesce(snapshot_item_count,0)::integer represented_items,
    case when id is null and exists (
      select 1 from public.supplier_observation_sets x where x.source=members.source
       and x.is_complete and x.status='complete' and x.completeness='known' and x.observed_at < v_cutoff
    ) then 'expired'
    when id is null then 'missing'
    when observed_at >= v_day_start then 'fresh' else 'carried' end selection_state
  from members;

  select count(*) filter(where observation_set_id is not null),
    count(*) filter(where selection_state='fresh'), count(*) filter(where selection_state='carried'),
    count(*) filter(where selection_state='expired'), sum(expected_items),
    sum(represented_items) filter(where observation_set_id is not null),
    sum(represented_items) filter(where selection_state='fresh'),
    sum(represented_items) filter(where selection_state='carried')
  into v_represented_sources,v_fresh_sources,v_carried_sources,v_expired_sources,v_expected_items,
       v_represented_items,v_fresh_items,v_carried_items from pg_temp._selected;
  v_expected_items := coalesce(v_expected_items,0); v_represented_items := coalesce(v_represented_items,0);
  v_fresh_items := coalesce(v_fresh_items,0); v_carried_items := coalesce(v_carried_items,0);
  v_supplier_coverage := case when v_cohort.expected_source_count=0 then 0 else v_represented_sources::numeric/v_cohort.expected_source_count end;
  v_item_coverage := case when v_expected_items=0 then 0 else least(1,v_represented_items::numeric/v_expected_items) end;
  v_stale := case when v_represented_items=0 then 0 else v_carried_items::numeric/v_represented_items end;
  v_tier := case
    when v_supplier_coverage >= v_policy.healthy_supplier_coverage
      and v_item_coverage >= v_policy.healthy_item_coverage
      and v_stale <= v_policy.healthy_max_stale_share then 'healthy'
    when v_supplier_coverage >= v_policy.degraded_supplier_coverage
      and v_item_coverage >= v_policy.degraded_item_coverage
      and v_stale <= v_policy.degraded_max_stale_share then 'degraded'
    else 'suppressed' end;
  v_score := least(1,
    v_policy.supplier_coverage_weight*v_supplier_coverage
    + v_policy.item_coverage_weight*v_item_coverage
    + v_policy.freshness_weight*(1-v_stale));

  insert into public.market_publications(id,as_of_date,cohort_id,predecessor_publication_id,policy_version,methodology_version,
    expected_source_count,represented_source_count,fresh_source_count,carried_source_count,expired_source_count,
    expected_item_count,represented_item_count,fresh_item_count,carried_item_count,supplier_coverage_ratio,
    item_coverage_ratio,stale_share,oldest_observed_at,max_observation_age,quality_tier,quality_score)
  select v_pub,p_as_of_date,v_cohort.id,v_prior,v_policy.policy_version,v_cohort.methodology_version,v_cohort.expected_source_count,
    v_represented_sources,v_fresh_sources,v_carried_sources,v_expired_sources,v_expected_items,v_represented_items,
    v_fresh_items,v_carried_items,v_supplier_coverage,v_item_coverage,v_stale,min(observed_at),
    max(v_cutoff-observed_at),v_tier,v_score from pg_temp._selected where observation_set_id is not null;

  insert into public.market_publication_source_evidence
  select v_pub,source,expected_items,represented_items,source_weight,selection_state,observed_at,
    case when observed_at is null then null else v_cutoff-observed_at end from pg_temp._selected;
  insert into public.market_publication_inputs(publication_id,source,observation_set_id,freshness,observation_age,stock_confidence)
  select v_pub,source,observation_set_id,selection_state,v_cutoff-observed_at,
    case when selection_state='fresh' then 'observed' else 'carried' end
  from pg_temp._selected where observation_set_id is not null;

  insert into public.market_publication_supplier_segments(publication_id,source,origin,process,grade,wholesale_only,source_weight,item_count,source_price_median)
  select v_pub,s.source,coalesce(o.origin,'Unknown'),nullif(btrim(o.process),''),nullif(btrim(o.grade),''),
    coalesce(o.wholesale,false),s.source_weight,count(*),
    percentile_cont(.5) within group(order by o.price)::numeric(12,4)
  from pg_temp._selected s join public.coffee_price_observations o on o.observation_set_id=s.observation_set_id
  where o.price is not null and o.price>0 and o.stocked is true
  group by s.source,coalesce(o.origin,'Unknown'),nullif(btrim(o.process),''),nullif(btrim(o.grade),''),coalesce(o.wholesale,false),s.source_weight;

  insert into public.market_publication_price_indexes(publication_id,origin,process,grade,wholesale_only,
    supplier_count,sample_size,price_min,price_max,price_avg,price_median,price_p25,price_p75,price_stdev,aggregation_tier)
  select v_pub,origin,process,grade,wholesale_only,count(*),sum(item_count),min(source_price_median),max(source_price_median),
    (sum(source_price_median*source_weight)/sum(source_weight))::numeric(12,4),
    public.market_weighted_percentile(array_agg(source_price_median),array_agg(source_weight),.5)::numeric(12,4),
    public.market_weighted_percentile(array_agg(source_price_median),array_agg(source_weight),.25)::numeric(12,4),
    public.market_weighted_percentile(array_agg(source_price_median),array_agg(source_weight),.75)::numeric(12,4),
    sqrt(greatest(0,sum(source_weight*source_price_median*source_price_median)/sum(source_weight)
      - power(sum(source_weight*source_price_median)/sum(source_weight),2)))::numeric(12,4),
    case when grade is not null then 3 when process is not null then 2 else 1 end
  from public.market_publication_supplier_segments segment
  where segment.publication_id=v_pub
  group by segment.origin,segment.process,segment.grade,segment.wholesale_only;

  insert into public.market_publication_movements(publication_id,origin,process,grade,wholesale_only,prior_publication_id,
    matched_supplier_count,matched_weight,current_weight,prior_weight,matched_weight_ratio,total_price_relative,
    matched_price_relative,movement_pct,assortment_shift_pct,movement_status)
  with cur as (
    select segment.* from public.market_publication_supplier_segments segment
    where segment.publication_id=v_pub
  ),
  prev as (
    select segment.* from public.market_publication_supplier_segments segment
    where segment.publication_id=v_prior
  ),
  matched as (
    select c.*, p.source_price_median prior_median
    from cur c join prev p on p.source=c.source
      and p.origin=c.origin and p.process is not distinct from c.process and p.grade is not distinct from c.grade
      and p.wholesale_only=c.wholesale_only
  ), cur_totals as (
    select origin,process,grade,wholesale_only,sum(source_weight) weight,
      sum(source_price_median*source_weight)/sum(source_weight) price
    from cur group by 1,2,3,4
  ), prev_totals as (
    select origin,process,grade,wholesale_only,sum(source_weight) weight,
      sum(source_price_median*source_weight)/sum(source_weight) price
    from prev group by 1,2,3,4
  ), matched_totals as (
    select origin,process,grade,wholesale_only,count(*) supplier_count,sum(source_weight) weight,
      sum((source_price_median/prior_median)*source_weight)/sum(source_weight) price_relative
    from matched group by 1,2,3,4
  ), decomposed as (
    select c.*,coalesce(p.weight,0) prior_weight,p.price prior_price,
      coalesce(m.supplier_count,0) matched_supplier_count,coalesce(m.weight,0) matched_weight,
      m.price_relative matched_price_relative,
      c.price/nullif(p.price,0) total_price_relative,
      least(coalesce(m.weight,0)/nullif(c.weight,0),coalesce(m.weight,0)/nullif(p.weight,0)) overlap
    from cur_totals c
    left join prev_totals p on p.origin=c.origin and p.process is not distinct from c.process
      and p.grade is not distinct from c.grade and p.wholesale_only=c.wholesale_only
    left join matched_totals m on m.origin=c.origin and m.process is not distinct from c.process
      and m.grade is not distinct from c.grade and m.wholesale_only=c.wholesale_only
  )
  select v_pub,d.origin,d.process,d.grade,d.wholesale_only,v_prior,d.matched_supplier_count,
    d.matched_weight,d.weight,d.prior_weight,d.overlap,d.total_price_relative,
    case when v_prior is not null and d.matched_supplier_count>=2 and d.overlap>=.5
      then d.matched_price_relative end,
    case when v_prior is not null and d.matched_supplier_count>=2 and d.overlap>=.5
      then d.matched_price_relative-1 end,
    case when v_prior is not null and d.matched_supplier_count>=2 and d.overlap>=.5
      then d.total_price_relative/nullif(d.matched_price_relative,0)-1 end,
    case when v_prior is null then 'no_prior'
      when d.matched_supplier_count>=2 and d.overlap>=.5 then 'publishable'
      else 'insufficient_overlap' end
  from decomposed d;

  if v_tier='suppressed' then
    update public.market_publications set status='rejected',rejected_at=clock_timestamp() where id=v_pub;
    v_action := 'suppressed';
  else
    select * into v_old from public.market_publications existing
     where existing.as_of_date=p_as_of_date and existing.cohort_id=v_cohort.id and existing.status='active'
     for update;
    v_had_old := found;
    select exists (
      select 1 from public.market_publications successor
      where successor.cohort_id=v_cohort.id and successor.status='active'
        and successor.as_of_date>p_as_of_date
      for share
    ) into v_chain_finalized;
    if v_chain_finalized then
      update public.market_publications set status='rejected',rejected_at=clock_timestamp() where id=v_pub;
      v_action := 'rejected_chain_finalized';
    elsif v_had_old and not (
      (case v_tier when 'healthy' then 2 else 1 end, v_score, v_supplier_coverage, v_item_coverage,
       -v_stale, v_fresh_sources, v_fresh_items,
       -extract(epoch from coalesce((select max(v_cutoff-observed_at) from pg_temp._selected where observation_set_id is not null),interval '999 years')),
       coalesce((select max(observed_at) from pg_temp._selected where observation_set_id is not null),'-infinity'::timestamptz))
      >
      (case v_old.quality_tier when 'healthy' then 2 when 'degraded' then 1 else 0 end, v_old.quality_score,
       v_old.supplier_coverage_ratio, v_old.item_coverage_ratio, -v_old.stale_share,
       v_old.fresh_source_count, v_old.fresh_item_count,
       -extract(epoch from coalesce(v_old.max_observation_age,interval '999 years')),
       coalesce((select max(s.observed_at) from public.market_publication_inputs i
         join public.supplier_observation_sets s on s.id=i.observation_set_id where i.publication_id=v_old.id),'-infinity'::timestamptz))
    ) then
      update public.market_publications set status='rejected',rejected_at=clock_timestamp() where id=v_pub;
      v_action := 'rejected_not_better';
    else
      if v_had_old then update public.market_publications set status='rejected',rejected_at=clock_timestamp() where id=v_old.id; end if;
      update public.market_publications set status='active',sealed_at=clock_timestamp(),published_at=clock_timestamp() where id=v_pub;
      v_action := case when v_had_old then 'replaced' else 'activated' end;
    end if;
  end if;
  return query select v_pub,(select p.status from public.market_publications p where p.id=v_pub),v_tier,
    v_supplier_coverage,v_item_coverage,v_stale,v_action;
end $$;

revoke all on function public.build_market_publication(date,text,integer) from public, anon, authenticated;
grant execute on function public.build_market_publication(date,text,integer) to service_role;
revoke all on function public.acquire_supplier_scrape_lease(text,uuid,interval) from public, anon, authenticated;
grant execute on function public.acquire_supplier_scrape_lease(text,uuid,interval) to service_role;
revoke all on function public.release_supplier_scrape_lease(text,uuid,bigint) from public, anon, authenticated;
grant execute on function public.release_supplier_scrape_lease(text,uuid,bigint) to service_role;
revoke all on function public.market_weighted_percentile(numeric[],numeric[],numeric) from public, anon, authenticated;
grant execute on function public.market_weighted_percentile(numeric[],numeric[],numeric) to service_role;
revoke all on function public.guard_market_publication_quality_policy() from public, anon, authenticated;
revoke all on function public.guard_market_publication_predecessor() from public, anon, authenticated;
grant usage, select on sequence public.supplier_scrape_lease_fence_seq to service_role;
grant usage, select on sequence public.market_publication_supplier_segments_id_seq to service_role;
grant usage, select on sequence public.market_publication_movements_id_seq to service_role;

comment on function public.build_market_publication(date,text,integer) is
  'Builds all candidate artifacts, scores against explicit expected denominators, and atomically promotes only a strictly better whole publication.';
comment on function public.acquire_supplier_scrape_lease(text,uuid,interval) is
  'Acquires or renews a supplier capture lease and returns its monotonic fence; returns NULL while another run owns a live lease.';
comment on function public.release_supplier_scrape_lease(text,uuid,bigint) is
  'Releases a supplier capture lease only when the supplied scrape run and monotonic fence own it.';
