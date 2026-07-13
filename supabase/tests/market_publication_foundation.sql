-- Executable behavior contract. Run after 20260713_market_publication_foundation.sql.
begin;

do $$
declare
  v_catalog_id integer;
  v_cohort uuid;
  v_open_set uuid;
  v_other_open_set uuid;
  v_complete_set uuid;
  v_legacy_set uuid;
  v_pub uuid;
  v_other_pub uuid;
  v_observation bigint;
  v_aggregate bigint;
begin
  insert into public.coffee_catalog(name) values ('market publication contract fixture') returning id into v_catalog_id;
  insert into public.market_index_cohorts(cohort_key, version, methodology_version, expected_source_count, effective_from)
    values ('contract', 1, 'supplier-first-v1', 1, current_date) returning id into v_cohort;
  insert into public.market_index_cohort_sources(cohort_id, source, carry_forward_ttl)
    values (v_cohort, 'fixture', interval '3 days');

  insert into public.supplier_observation_sets(source, observed_at, status, completeness, expected_item_count)
    values ('fixture', now(), 'partial', 'known', 1) returning id into v_open_set;
  insert into public.coffee_price_observations(observation_set_id, catalog_id, source, observed_at, price)
    values (v_open_set, v_catalog_id, 'fixture', now(), 10) returning id into v_observation;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, expected_item_count)
    values ('fixture', now(), 'partial', 'known', 1) returning id into v_other_open_set;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, expected_item_count, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', now(), 'complete', 'known', 1, 1, 1, true) returning id into v_complete_set;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', now() - interval '1 day', 'legacy', 'legacy', 1, 1, true) returning id into v_legacy_set;

  insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
    expected_source_count, represented_source_count, fresh_source_count, expected_item_count, represented_item_count, fresh_item_count,
    supplier_coverage_ratio, item_coverage_ratio, stale_share, quality_tier, quality_score)
    values (current_date, v_cohort, 'quality-v1', 'supplier-first-v1', 1, 1, 1, 1, 1, 1, 1, 1, 0, 'healthy', 1)
    returning id into v_pub;
  insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
    expected_source_count, represented_source_count, fresh_source_count, quality_tier)
    values (current_date + 1, v_cohort, 'quality-v1', 'supplier-first-v1', 1, 1, 1, 'unknown')
    returning id into v_other_pub;

  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_legacy_set, 'carried', interval '1 day');
    raise exception 'legacy observation set was accepted';
  exception when others then
    if sqlerrm = 'legacy observation set was accepted' then raise; end if;
  end;

  insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
    values (v_pub, 'fixture', v_complete_set, 'fresh', interval '0 seconds');

  begin
    insert into public.market_publications(as_of_date, cohort_id, status, policy_version, methodology_version,
      expected_source_count, quality_tier, sealed_at, published_at)
      values (current_date + 2, v_cohort, 'active', 'quality-v1', 'supplier-first-v1', 1, 'healthy', now(), now());
    raise exception 'direct active publication insert was accepted';
  exception when others then
    if sqlerrm = 'direct active publication insert was accepted' then raise; end if;
  end;

  update public.market_publications set status = 'active', sealed_at = now(), published_at = now() where id = v_pub;

  begin
    update public.market_index_cohort_sources set source_weight = 2 where cohort_id = v_cohort and source = 'fixture';
    raise exception 'referenced cohort membership was mutable';
  exception when others then
    if sqlerrm = 'referenced cohort membership was mutable' then raise; end if;
  end;
  begin
    update public.market_index_cohorts set methodology_version = 'mutated' where id = v_cohort;
    raise exception 'referenced cohort definition was mutable';
  exception when others then
    if sqlerrm = 'referenced cohort definition was mutable' then raise; end if;
  end;

  begin
    update public.market_publication_inputs set publication_id = v_other_pub where publication_id = v_pub;
    raise exception 'artifact update out of sealed publication was accepted';
  exception when others then
    if sqlerrm = 'artifact update out of sealed publication was accepted' then raise; end if;
  end;

  insert into public.market_publication_price_indexes(publication_id, origin, wholesale_only, supplier_count,
    sample_size, price_min, price_max, price_avg, price_median, price_p25, price_p75, price_stdev, aggregation_tier)
    values (v_other_pub, 'Fixture', false, 1, 1, 10, 10, 10, 10, 10, 10, 0, 1)
    returning id into v_aggregate;
  begin
    update public.market_publication_price_indexes set publication_id = v_pub where id = v_aggregate;
    raise exception 'artifact update into sealed publication was accepted';
  exception when others then
    if sqlerrm = 'artifact update into sealed publication was accepted' then raise; end if;
  end;

  update public.supplier_observation_sets
    set status = 'complete', is_complete = true, observed_item_count = 1, snapshot_item_count = 1
    where id = v_open_set;
  begin
    update public.coffee_price_observations set observation_set_id = v_complete_set where id = v_observation;
    raise exception 'observation update out of complete set was accepted';
  exception when others then
    if sqlerrm = 'observation update out of complete set was accepted' then raise; end if;
  end;
  insert into public.coffee_price_observations(observation_set_id, catalog_id, source, observed_at, price)
    values (v_other_open_set, v_catalog_id, 'fixture', now(), 10) returning id into v_observation;
  begin
    update public.coffee_price_observations set observation_set_id = v_complete_set where id = v_observation;
    raise exception 'observation update into complete set was accepted';
  exception when others then
    if sqlerrm = 'observation update into complete set was accepted' then raise; end if;
  end;

  update public.market_publications set status = 'rejected', rejected_at = now() where id = v_other_pub;
  begin
    update public.market_publications set status = 'active', sealed_at = now(), published_at = now(), rejected_at = null
      where id = v_other_pub;
    raise exception 'rejected publication was not terminal';
  exception when others then
    if sqlerrm = 'rejected publication was not terminal' then raise; end if;
  end;

  begin
    insert into public.market_publication_price_indexes(publication_id, origin, wholesale_only, supplier_count,
      sample_size, price_min, price_max, price_median, price_p25, price_p75, aggregation_tier)
      values (v_other_pub, 'Invalid', false, 2, 1, 20, 10, 15, 18, 12, 4);
    raise exception 'invalid aggregate was accepted';
  exception when check_violation then null;
  end;
end $$;

rollback;
