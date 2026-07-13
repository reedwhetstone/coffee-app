-- Provenance-aware supplier observations and atomic market publications.
-- Additive foundation: legacy snapshot readers and writers remain unchanged.

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  command text not null check (length(btrim(command)) > 0),
  code_revision text,
  requested_source_count integer not null default 0 check (requested_source_count >= 0),
  selected_source_count integer not null default 0 check (selected_source_count >= 0 and selected_source_count <= requested_source_count),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'degraded', 'failed', 'cancelled', 'legacy')),
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create table public.supplier_observation_sets (
  id uuid primary key default gen_random_uuid(),
  scrape_run_id uuid references public.scrape_runs(id) on delete restrict,
  source text not null check (length(btrim(source)) > 0),
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
  source text not null check (length(btrim(source)) > 0),
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
  foreign key (observation_set_id, source) references public.supplier_observation_sets(id, source) on delete restrict,
  check (price_tiers is null or jsonb_typeof(price_tiers) = 'array')
);

create table public.market_index_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null check (length(btrim(cohort_key)) > 0),
  version integer not null check (version > 0),
  methodology_version text not null check (length(btrim(methodology_version)) > 0),
  expected_source_count integer not null check (expected_source_count >= 0),
  description text,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (cohort_key, version),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.market_index_cohort_sources (
  cohort_id uuid not null references public.market_index_cohorts(id) on delete restrict,
  source text not null check (length(btrim(source)) > 0),
  carry_forward_ttl interval not null default interval '3 days' check (carry_forward_ttl >= interval '0 seconds'),
  source_weight numeric(12, 6) not null default 1 check (source_weight > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (cohort_id, source)
);

create table public.market_publications (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null,
  cohort_id uuid not null references public.market_index_cohorts(id) on delete restrict,
  status text not null default 'candidate' check (status in ('candidate', 'active', 'rejected')),
  policy_version text not null check (length(btrim(policy_version)) > 0),
  methodology_version text not null check (length(btrim(methodology_version)) > 0),
  represented_source_count integer not null default 0 check (represented_source_count >= 0),
  fresh_source_count integer not null default 0 check (fresh_source_count >= 0),
  carried_source_count integer not null default 0 check (carried_source_count >= 0),
  expired_source_count integer not null default 0 check (expired_source_count >= 0),
  expected_item_count integer check (expected_item_count is null or expected_item_count >= 0),
  represented_item_count integer not null default 0 check (represented_item_count >= 0),
  fresh_item_count integer not null default 0 check (fresh_item_count >= 0),
  carried_item_count integer not null default 0 check (carried_item_count >= 0),
  supplier_coverage_ratio numeric(8, 6) check (supplier_coverage_ratio between 0 and 1),
  item_coverage_ratio numeric(8, 6) check (item_coverage_ratio between 0 and 1),
  stale_share numeric(8, 6) check (stale_share between 0 and 1),
  oldest_observed_at timestamptz,
  max_observation_age interval check (max_observation_age is null or max_observation_age >= interval '0 seconds'),
  quality_tier text not null check (quality_tier in ('healthy', 'degraded', 'suppressed', 'unknown', 'legacy')),
  quality_score numeric(8, 6) check (quality_score between 0 and 1),
  sealed_at timestamptz,
  published_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  check (fresh_source_count + carried_source_count <= represented_source_count),
  check (fresh_item_count + carried_item_count <= represented_item_count),
  check (status <> 'active' or (published_at is not null and sealed_at is not null)),
  check (status <> 'candidate' or (published_at is null and sealed_at is null)),
  check (status <> 'rejected' or rejected_at is not null)
);

create unique index market_publications_one_active_per_date_cohort
  on public.market_publications (as_of_date, cohort_id) where status = 'active';
create index market_publications_candidates on public.market_publications (as_of_date desc, cohort_id, quality_score desc) where status = 'candidate';

create table public.market_publication_inputs (
  publication_id uuid not null references public.market_publications(id) on delete restrict,
  source text not null,
  observation_set_id uuid not null,
  freshness text not null check (freshness in ('fresh', 'carried', 'legacy')),
  observation_age interval not null check (observation_age >= interval '0 seconds'),
  stock_confidence text not null default 'observed' check (stock_confidence in ('observed', 'carried', 'unknown')),
  created_at timestamptz not null default now(),
  primary key (publication_id, source),
  unique (publication_id, observation_set_id),
  foreign key (observation_set_id, source) references public.supplier_observation_sets(id, source) on delete restrict
);

create table public.market_publication_price_indexes (
  id bigint generated always as identity primary key,
  publication_id uuid not null references public.market_publications(id) on delete restrict,
  origin text not null,
  process text,
  grade text,
  wholesale_only boolean not null default false,
  supplier_count integer not null check (supplier_count >= 0),
  sample_size integer not null check (sample_size >= 0),
  price_min numeric(12, 4),
  price_max numeric(12, 4),
  price_avg numeric(12, 4),
  price_median numeric(12, 4),
  price_p25 numeric(12, 4),
  price_p75 numeric(12, 4),
  price_stdev numeric(12, 4),
  aggregation_tier text,
  created_at timestamptz not null default now()
);
create unique index market_publication_price_indexes_segment
  on public.market_publication_price_indexes
  (publication_id, origin, coalesce(process, ''), coalesce(grade, ''), wholesale_only);

create or replace function public.guard_market_publication_immutability()
returns trigger language plpgsql set search_path = public as $$
declare v_publication_id uuid; v_sealed_at timestamptz;
begin
  if tg_op = 'DELETE' then v_publication_id := old.publication_id; else v_publication_id := new.publication_id; end if;
  select sealed_at into v_sealed_at from public.market_publications where id = v_publication_id;
  if v_sealed_at is not null then raise exception 'Sealed market publication artifacts are immutable'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create trigger guard_active_publication_inputs before insert or update or delete on public.market_publication_inputs
  for each row execute function public.guard_market_publication_immutability();
create trigger guard_active_publication_aggregates before insert or update or delete on public.market_publication_price_indexes
  for each row execute function public.guard_market_publication_immutability();

create or replace function public.guard_sealed_market_publication()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.sealed_at is not null then
    if tg_op = 'DELETE' then raise exception 'Sealed market publications are immutable'; end if;
    if not (old.status = 'active' and new.status = 'rejected'
      and (to_jsonb(new) - array['status', 'rejected_at']) = (to_jsonb(old) - array['status', 'rejected_at'])
      and new.rejected_at is not null) then
      raise exception 'Only atomic retirement may update a sealed market publication';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger guard_sealed_market_publication before update or delete on public.market_publications
  for each row execute function public.guard_sealed_market_publication();

create or replace function public.guard_complete_observation_set_immutability()
returns trigger language plpgsql set search_path = public as $$
declare v_set_id uuid; v_complete boolean;
begin
  if tg_table_name = 'supplier_observation_sets' then
    v_set_id := old.id;
  elsif tg_op = 'DELETE' then
    v_set_id := old.observation_set_id;
  else
    v_set_id := new.observation_set_id;
  end if;
  select is_complete into v_complete from public.supplier_observation_sets where id = v_set_id;
  if v_complete then raise exception 'Complete supplier observation sets are immutable'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger guard_complete_observation_set before update or delete on public.supplier_observation_sets
  for each row when (old.is_complete) execute function public.guard_complete_observation_set_immutability();
create trigger guard_complete_observations before insert or update or delete on public.coffee_price_observations
  for each row execute function public.guard_complete_observation_set_immutability();

create index supplier_observation_sets_source_observed on public.supplier_observation_sets (source, observed_at desc) where is_complete;
create index coffee_price_observations_set on public.coffee_price_observations (observation_set_id);
create index market_publication_inputs_set on public.market_publication_inputs (observation_set_id);

comment on table public.supplier_observation_sets is 'Immutable supplier-level observation identity. Unknown/legacy completeness supports honest backfill without claiming freshness.';
comment on table public.scrape_runs is 'Operational scrape invocation identity and source-selection outcome; does not itself authorize market publication.';
comment on table public.coffee_price_observations is 'Observed-at facts; carry-forward references these rows and never fabricates a new publication date or fresh stock assertion.';
comment on table public.market_index_cohorts is 'Explicit versioned production cohort; membership is not inferred from code-registered scraper sources.';
comment on table public.market_index_cohort_sources is 'Versioned cohort membership, influence weight, and source-specific carry-forward TTL.';
comment on table public.market_publications is 'Quality-scored candidate or atomically selected daily publication. Policy thresholds are versioned data/logic, not table constraints.';
comment on table public.market_publication_inputs is 'Exact provenance manifest from publication source to supplier observation set.';
comment on table public.market_publication_price_indexes is 'Publication-scoped aggregate segments. Candidate rows coexist and never partially upsert into a shared daily aggregate.';

do $$ declare t text; begin
  foreach t in array array['scrape_runs','supplier_observation_sets','coffee_price_observations','market_index_cohorts','market_index_cohort_sources','market_publications','market_publication_inputs','market_publication_price_indexes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'Service role only ' || t, t);
  end loop;
end $$;

revoke all on function public.guard_market_publication_immutability() from public, anon, authenticated;
revoke all on function public.guard_sealed_market_publication() from public, anon, authenticated;
revoke all on function public.guard_complete_observation_set_immutability() from public, anon, authenticated;
grant usage, select on sequence public.coffee_price_observations_id_seq to service_role;
grant usage, select on sequence public.market_publication_price_indexes_id_seq to service_role;
