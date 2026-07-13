-- Executable behavior contract for non-activating provenance storage.
begin;

do $$
declare
  v_catalog_id integer;
  v_run uuid;
  v_other_run uuid;
  v_fence bigint;
  v_zero_fence bigint;
  v_set uuid;
  v_zero_set uuid;
  v_cohort uuid;
  v_count integer;
begin
  if to_regclass('public.market_publications') is not null
    or to_regclass('public.market_publication_inputs') is not null
    or to_regclass('public.market_publication_price_indexes') is not null then
    raise exception 'publication storage exists in provenance-only foundation';
  end if;

  insert into public.coffee_catalog(name)
    values ('market provenance contract fixture') returning id into v_catalog_id;

  insert into public.scrape_runs(command, requested_source_count, selected_source_count)
    values ('scrape source fixture', 1, 1) returning id into v_run;
  if (select publication_scope from public.scrape_runs where id = v_run) <> 'non-production' then
    raise exception 'scrape run did not default to non-production';
  end if;
  insert into public.scrape_runs(command, publication_scope, requested_source_count, selected_source_count)
    values ('scrape all', 'production', 1, 1) returning id into v_other_run;

  v_fence := public.acquire_supplier_scrape_lease('fixture', v_run, interval '1 hour');
  if v_fence is null then raise exception 'supplier lease was not acquired'; end if;
  if public.acquire_supplier_scrape_lease('fixture', v_other_run, interval '1 hour') is not null then
    raise exception 'live supplier lease was stolen';
  end if;

  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_run, v_fence, 'fixture', now(), 'partial', 1) returning id into v_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price, stocked)
  select v_set, v_catalog_id, 'fixture', observed_at, 10, true
  from public.supplier_observation_sets where id = v_set;
  update public.supplier_observation_sets
    set status = 'complete', is_complete = true, observed_item_count = 1, snapshot_item_count = 1
    where id = v_set;
  begin
    update public.coffee_price_observations set price = 11 where observation_set_id = v_set;
    raise exception 'complete observation set was mutable';
  exception when others then
    if sqlerrm = 'complete observation set was mutable' then raise; end if;
  end;

  v_zero_fence := public.acquire_supplier_scrape_lease('zero-fixture', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_other_run, v_zero_fence, 'zero-fixture', now(), 'partial', 0) returning id into v_zero_set;
  begin
    update public.supplier_observation_sets
      set status = 'complete', is_complete = true where id = v_zero_set;
    raise exception 'zero-result supplier failure was accepted as complete';
  exception when others then
    if sqlerrm = 'zero-result supplier failure was accepted as complete' then raise; end if;
    if position('Zero-result supplier capture is a failure' in sqlerrm) = 0 then
      raise exception 'zero-result rejection hit the wrong guard: %', sqlerrm;
    end if;
  end;

  insert into public.market_index_cohorts
    (cohort_key, version, methodology_version, effective_from)
  values ('contract', 1, 'supplier-first-v1', current_date) returning id into v_cohort;
  insert into public.market_index_cohort_sources(cohort_id, source)
    values (v_cohort, 'fixture'), (v_cohort, 'disabled-fixture');
  update public.market_index_cohort_sources set enabled = false
    where cohort_id = v_cohort and source = 'disabled-fixture';
  select enabled_source_count into v_count from public.market_index_cohort_enabled_counts
    where cohort_id = v_cohort;
  if v_count <> 1 then raise exception 'enabled cohort cardinality was not derived from membership'; end if;
  if public.freeze_market_index_cohort(v_cohort) <> 1 then
    raise exception 'cohort freeze did not return derived enabled count';
  end if;
  begin
    update public.market_index_cohort_sources set source_weight = 2
      where cohort_id = v_cohort and source = 'fixture';
    raise exception 'frozen cohort membership was mutable';
  exception when others then
    if sqlerrm = 'frozen cohort membership was mutable' then raise; end if;
  end;
  begin
    update public.market_index_cohorts set methodology_version = 'mutated' where id = v_cohort;
    raise exception 'frozen cohort definition was mutable';
  exception when others then
    if sqlerrm = 'frozen cohort definition was mutable' then raise; end if;
  end;

  -- effective_to is exclusive: retirement and successor introduction share a boundary.
  update public.market_index_cohorts set effective_to = current_date + 1 where id = v_cohort;
  insert into public.market_index_cohorts
    (cohort_key, version, methodology_version, effective_from)
  values ('contract', 2, 'supplier-first-v2', current_date + 1);
  begin
    update public.market_index_cohorts set effective_to = current_date + 2 where id = v_cohort;
    raise exception 'retired cohort boundary was mutable';
  exception when others then
    if sqlerrm = 'retired cohort boundary was mutable' then raise; end if;
  end;

  if not public.release_supplier_scrape_lease('fixture', v_run, v_fence) then
    raise exception 'owned supplier lease was not released';
  end if;
end $$;

rollback;
