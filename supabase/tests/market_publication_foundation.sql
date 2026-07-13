-- Executable behavior contract. Run after 20260713_market_publication_foundation.sql.
begin;

do $$
declare
  v_catalog_id integer;
  v_cohort uuid;
  v_expired_cohort uuid;
  v_open_set uuid;
  v_other_open_set uuid;
  v_complete_set uuid;
  v_legacy_set uuid;
  v_unknown_complete_set uuid;
  v_legacy_complete_set uuid;
  v_carried_set uuid;
  v_future_set uuid;
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
  insert into public.market_index_cohorts(cohort_key, version, methodology_version, expected_source_count, effective_from, effective_to)
    values ('expired-contract', 1, 'supplier-first-v1', 0, current_date - 1, current_date)
    returning id into v_expired_cohort;

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
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', now(), 'complete', 'unknown', 1, 1, true) returning id into v_unknown_complete_set;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', now(), 'complete', 'legacy', 1, 1, true) returning id into v_legacy_complete_set;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, expected_item_count, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', current_date - interval '1 hour', 'complete', 'known', 1, 1, 1, true) returning id into v_carried_set;
  insert into public.supplier_observation_sets(source, observed_at, status, completeness, expected_item_count, observed_item_count, snapshot_item_count, is_complete)
    values ('fixture', current_date + interval '2 days', 'complete', 'known', 1, 1, 1, true) returning id into v_future_set;

  insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
    expected_source_count, represented_source_count, fresh_source_count, expected_item_count, represented_item_count, fresh_item_count,
    supplier_coverage_ratio, item_coverage_ratio, stale_share, quality_tier, quality_score)
    values (current_date, v_cohort, 'quality-v1', 'supplier-first-v1', 1, 1, 1, 1, 1, 1, 1, 1, 0, 'healthy', 1)
    returning id into v_pub;
  insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
    expected_source_count, represented_source_count, fresh_source_count, quality_tier)
    values (current_date + 1, v_cohort, 'quality-v1', 'supplier-first-v1', 1, 1, 1, 'suppressed')
    returning id into v_other_pub;

  begin
    insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
      expected_source_count, quality_tier)
      values (current_date - 1, v_cohort, 'quality-v1', 'supplier-first-v1', 1, 'healthy');
    raise exception 'publication before cohort effective window was accepted';
  exception when others then
    if sqlerrm = 'publication before cohort effective window was accepted' then raise; end if;
  end;
  begin
    insert into public.market_publications(as_of_date, cohort_id, policy_version, methodology_version,
      expected_source_count, quality_tier)
      values (current_date + 1, v_expired_cohort, 'quality-v1', 'supplier-first-v1', 0, 'healthy');
    raise exception 'publication after cohort effective window was accepted';
  exception when others then
    if sqlerrm = 'publication after cohort effective window was accepted' then raise; end if;
  end;

  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_legacy_set, 'carried', interval '1 day');
    raise exception 'legacy observation set was accepted';
  exception when others then
    if sqlerrm = 'legacy observation set was accepted' then raise; end if;
  end;
  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_unknown_complete_set, 'fresh', interval '0 seconds');
    raise exception 'unknown-completeness complete set was accepted';
  exception when others then
    if sqlerrm = 'unknown-completeness complete set was accepted' then raise; end if;
  end;
  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_legacy_complete_set, 'fresh', interval '0 seconds');
    raise exception 'legacy-completeness complete set was accepted';
  exception when others then
    if sqlerrm = 'legacy-completeness complete set was accepted' then raise; end if;
  end;
  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_complete_set, 'carried', interval '0 seconds');
    raise exception 'same-day observation was accepted as carried';
  exception when others then
    if sqlerrm = 'same-day observation was accepted as carried' then raise; end if;
  end;
  begin
    insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
      values (v_pub, 'fixture', v_future_set, 'fresh', interval '0 seconds');
    raise exception 'future observation was accepted';
  exception when others then
    if sqlerrm = 'future observation was accepted' then raise; end if;
  end;

  insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
    values (v_pub, 'fixture', v_complete_set, 'fresh', interval '0 seconds');
  if not exists (select 1 from public.market_publication_inputs where publication_id = v_pub and observation_age > interval '0 seconds') then
    raise exception 'caller-forged zero observation age was trusted';
  end if;
  insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age, stock_confidence)
    values (v_other_pub, 'fixture', v_carried_set, 'carried', interval '0 seconds', 'carried');
  if not exists (select 1 from public.market_publication_inputs where publication_id = v_other_pub and observation_age > interval '1 day') then
    raise exception 'caller-forged carried age was trusted';
  end if;

  begin
    insert into public.market_publications(as_of_date, cohort_id, status, policy_version, methodology_version,
      expected_source_count, quality_tier, sealed_at, published_at)
      values (current_date + 2, v_cohort, 'active', 'quality-v1', 'supplier-first-v1', 1, 'healthy', now(), now());
    raise exception 'direct active publication insert was accepted';
  exception when others then
    if sqlerrm = 'direct active publication insert was accepted' then raise; end if;
  end;

  begin
    update public.market_publications set status = 'active', sealed_at = now(), published_at = now()
      where id = v_other_pub;
    raise exception 'suppressed publication was activated';
  exception when others then
    if sqlerrm = 'suppressed publication was activated' then raise; end if;
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

  begin
    insert into public.market_publication_price_indexes(publication_id, origin, wholesale_only, supplier_count,
      sample_size, price_min, price_max, price_median, price_p25, price_p75, aggregation_tier)
      values (v_other_pub, 'Invalid', false, 2, 1, 20, 10, 15, 18, 12, 4);
    raise exception 'invalid aggregate was accepted';
  exception when check_violation then null;
  end;

  update public.market_publications set status = 'rejected', rejected_at = now() where id = v_other_pub;
  begin
    insert into public.market_publication_price_indexes(publication_id, origin, wholesale_only, supplier_count,
      sample_size, price_min, price_max, price_avg, price_median, price_p25, price_p75, price_stdev, aggregation_tier)
      values (v_other_pub, 'Rejected insert', false, 1, 1, 10, 10, 10, 10, 10, 10, 0, 1);
    raise exception 'rejected publication accepted artifact insert';
  exception when others then
    if sqlerrm = 'rejected publication accepted artifact insert' then raise; end if;
  end;
  begin
    update public.market_publication_price_indexes set price_avg = 9 where id = v_aggregate;
    raise exception 'rejected publication accepted artifact update';
  exception when others then
    if sqlerrm = 'rejected publication accepted artifact update' then raise; end if;
  end;
  begin
    delete from public.market_publication_price_indexes where id = v_aggregate;
    raise exception 'rejected publication accepted artifact delete';
  exception when others then
    if sqlerrm = 'rejected publication accepted artifact delete' then raise; end if;
  end;
  begin
    update public.market_publications set status = 'active', sealed_at = now(), published_at = now(), rejected_at = null
      where id = v_other_pub;
    raise exception 'rejected publication was not terminal';
  exception when others then
    if sqlerrm = 'rejected publication was not terminal' then raise; end if;
  end;
end $$;

rollback;
