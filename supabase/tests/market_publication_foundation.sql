-- Executable behavior contract for non-activating provenance storage.
begin;

do $$
declare
  v_catalog_id integer;
  v_run uuid;
  v_other_run uuid;
  v_lifecycle_run uuid;
  v_fence bigint;
  v_zero_fence bigint;
  v_stale_fence bigint;
  v_new_fence bigint;
  v_late_fence bigint;
  v_unknown_fence bigint;
  v_legacy_fence bigint;
  v_unknown_zero_fence bigint;
  v_legacy_zero_fence bigint;
  v_set uuid;
  v_zero_set uuid;
  v_stale_set uuid;
  v_late_set uuid;
  v_unknown_set uuid;
  v_legacy_set uuid;
  v_unknown_zero_set uuid;
  v_legacy_zero_set uuid;
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
  insert into public.scrape_runs(command, publication_scope, requested_source_count, selected_source_count)
    values ('scrape all lifecycle', 'production', 1, 1) returning id into v_lifecycle_run;

  begin
    update public.scrape_runs set publication_scope = 'production' where id = v_run;
    raise exception 'scrape run scope relabel was accepted';
  exception when others then
    if sqlerrm = 'scrape run scope relabel was accepted' then raise; end if;
    if position('scope, selection, and start metadata are immutable' in sqlerrm) = 0 then raise; end if;
  end;

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
  perform public.seal_supplier_observation_set(v_set, v_fence, 1, 1);
  begin
    update public.coffee_price_observations set price = 11 where observation_set_id = v_set;
    raise exception 'complete observation set was mutable';
  exception when others then
    if sqlerrm = 'complete observation set was mutable' then raise; end if;
  end;

  -- An expired lease always advances the fence, even for the same scrape run.
  v_stale_fence := public.acquire_supplier_scrape_lease('stale-fixture', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_other_run, v_stale_fence, 'stale-fixture', now(), 'partial', 1)
  returning id into v_stale_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price, stocked)
  select v_stale_set, v_catalog_id, 'stale-fixture', observed_at, 10, true
  from public.supplier_observation_sets where id = v_stale_set;
  update public.supplier_scrape_leases
    set acquired_at = clock_timestamp() - interval '2 hours',
        expires_at = clock_timestamp() - interval '1 hour'
    where source = 'stale-fixture';
  v_new_fence := public.acquire_supplier_scrape_lease('stale-fixture', v_other_run, interval '1 hour');
  if v_new_fence <= v_stale_fence then
    raise exception 'same-run expired lease reacquire reused its stale fence';
  end if;
  begin
    perform public.seal_supplier_observation_set(v_stale_set, v_stale_fence, 1, 1);
    raise exception 'stale lease fence sealed an observation set';
  exception when others then
    if sqlerrm = 'stale lease fence sealed an observation set' then raise; end if;
    if position('live fenced supplier lease' in sqlerrm) = 0 then raise; end if;
  end;

  -- Completeness labels do not bypass open-insert or non-empty sealing rules.
  begin
    insert into public.supplier_observation_sets
      (source, observed_at, status, completeness, is_complete)
    values ('direct-unknown', now(), 'complete', 'unknown', true);
    raise exception 'unknown observation set was inserted complete';
  exception when others then
    if sqlerrm = 'unknown observation set was inserted complete' then raise; end if;
    if position('All observation sets must be inserted open' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    insert into public.supplier_observation_sets
      (source, observed_at, status, completeness, is_complete)
    values ('direct-legacy', now(), 'complete', 'legacy', true);
    raise exception 'legacy observation set was inserted complete';
  exception when others then
    if sqlerrm = 'legacy observation set was inserted complete' then raise; end if;
    if position('All observation sets must be inserted open' in sqlerrm) = 0 then raise; end if;
  end;
  v_unknown_fence := public.acquire_supplier_scrape_lease('unknown-fixture', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, completeness)
    values (v_other_run, v_unknown_fence, 'unknown-fixture', now(), 'partial', 'unknown')
    returning id into v_unknown_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price)
  select v_unknown_set, v_catalog_id, 'unknown-fixture', observed_at, 10
  from public.supplier_observation_sets where id = v_unknown_set;
  perform public.seal_supplier_observation_set(v_unknown_set, v_unknown_fence, 1, 1);
  v_legacy_fence := public.acquire_supplier_scrape_lease('legacy-fixture', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, completeness)
    values (v_other_run, v_legacy_fence, 'legacy-fixture', now(), 'partial', 'legacy')
    returning id into v_legacy_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price)
  select v_legacy_set, v_catalog_id, 'legacy-fixture', observed_at, 10
  from public.supplier_observation_sets where id = v_legacy_set;
  perform public.seal_supplier_observation_set(v_legacy_set, v_legacy_fence, 1, 1);
  v_unknown_zero_fence := public.acquire_supplier_scrape_lease('unknown-zero', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, completeness)
    values (v_other_run, v_unknown_zero_fence, 'unknown-zero', now(), 'partial', 'unknown')
    returning id into v_unknown_zero_set;
  begin
    perform public.seal_supplier_observation_set(v_unknown_zero_set, v_unknown_zero_fence, 0, 0);
    raise exception 'zero-result unknown set was accepted as complete';
  exception when others then
    if sqlerrm = 'zero-result unknown set was accepted as complete' then raise; end if;
    if position('Zero-result supplier capture is a failure' in sqlerrm) = 0 then raise; end if;
  end;
  v_legacy_zero_fence := public.acquire_supplier_scrape_lease('legacy-zero', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, completeness)
    values (v_other_run, v_legacy_zero_fence, 'legacy-zero', now(), 'partial', 'legacy')
    returning id into v_legacy_zero_set;
  begin
    perform public.seal_supplier_observation_set(v_legacy_zero_set, v_legacy_zero_fence, 0, 0);
    raise exception 'zero-result legacy set was accepted as complete';
  exception when others then
    if sqlerrm = 'zero-result legacy set was accepted as complete' then raise; end if;
    if position('Zero-result supplier capture is a failure' in sqlerrm) = 0 then raise; end if;
  end;

  -- Run terminalization and set sealing serialize through the scrape run row.
  v_late_fence := public.acquire_supplier_scrape_lease('late-fixture', v_lifecycle_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_lifecycle_run, v_late_fence, 'late-fixture', now(), 'partial', 1)
  returning id into v_late_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price)
  select v_late_set, v_catalog_id, 'late-fixture', observed_at, 10
  from public.supplier_observation_sets where id = v_late_set;
  update public.scrape_runs set status = 'failed', completed_at = clock_timestamp()
    where id = v_lifecycle_run;
  begin
    update public.scrape_runs set status = 'running', completed_at = null where id = v_lifecycle_run;
    raise exception 'terminal scrape run was reopened';
  exception when others then
    if sqlerrm = 'terminal scrape run was reopened' then raise; end if;
    if position('cannot be reopened or relabeled' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    update public.scrape_runs set status = 'degraded' where id = v_lifecycle_run;
    raise exception 'terminal scrape run was relabeled';
  exception when others then
    if sqlerrm = 'terminal scrape run was relabeled' then raise; end if;
    if position('cannot be reopened or relabeled' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    perform public.seal_supplier_observation_set(v_late_set, v_late_fence, 1, 1);
    raise exception 'observation set sealed after run terminalization';
  exception when others then
    if sqlerrm = 'observation set sealed after run terminalization' then raise; end if;
    if position('cannot be sealed after their scrape run is terminal' in sqlerrm) = 0 then raise; end if;
  end;

  v_zero_fence := public.acquire_supplier_scrape_lease('zero-fixture', v_other_run, interval '1 hour');
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_other_run, v_zero_fence, 'zero-fixture', now(), 'partial', 0) returning id into v_zero_set;
  begin
    perform public.seal_supplier_observation_set(v_zero_set, v_zero_fence, 0, 0);
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
  begin
    update public.market_index_cohorts set frozen_at = null where id = v_cohort;
    raise exception 'frozen cohort marker was cleared';
  exception when others then
    if sqlerrm = 'frozen cohort marker was cleared' then raise; end if;
  end;
  begin
    update public.market_index_cohort_sources set enabled = false
      where cohort_id = v_cohort and source = 'fixture';
    raise exception 'cohort membership mutated after frozen marker clear attempt';
  exception when others then
    if sqlerrm = 'cohort membership mutated after frozen marker clear attempt' then raise; end if;
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

set local role service_role;
do $$
declare
  v_service_run uuid;
  v_service_set uuid;
  v_service_fence bigint;
  v_service_cohort uuid;
  v_service_enabled_count integer;
  v_service_frozen boolean;
begin
  if exists (
    select 1
    from unnest(array[
      'scrape_runs',
      'supplier_scrape_leases',
      'supplier_observation_sets',
      'coffee_price_observations',
      'market_index_cohorts',
      'market_index_cohort_sources'
    ]) as protected_table(name)
    where has_table_privilege(
      'service_role',
      format('public.%I', protected_table.name),
      'TRUNCATE'
    )
  ) then
    raise exception 'service role retained truncate privilege';
  end if;

  insert into public.scrape_runs(command, requested_source_count, selected_source_count)
  values ('service role seal fixture', 1, 1) returning id into v_service_run;
  v_service_fence := public.acquire_supplier_scrape_lease(
    'service-role-fixture', v_service_run, interval '1 hour'
  );
  insert into public.supplier_observation_sets
    (scrape_run_id, lease_fence, source, observed_at, status, expected_item_count)
  values (v_service_run, v_service_fence, 'service-role-fixture', now(), 'partial', 1)
  returning id into v_service_set;
  insert into public.coffee_price_observations
    (observation_set_id, catalog_id, source, observed_at, price)
  select v_service_set, 1, 'service-role-fixture', observed_at, 10
  from public.supplier_observation_sets where id = v_service_set;
  perform public.seal_supplier_observation_set(v_service_set, v_service_fence, 1, 1);
  if not (select is_complete from public.supplier_observation_sets where id = v_service_set) then
    raise exception 'service role seal RPC did not complete observation set';
  end if;

  begin
    update public.supplier_observation_sets set status = 'complete', is_complete = true
    where id = v_service_set;
    raise exception 'service role directly completed supplier observation set';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.supplier_scrape_leases(source, scrape_run_id, fence, acquired_at, expires_at)
    values ('forbidden-direct-dml', gen_random_uuid(), 1, now(), now() + interval '1 hour');
    raise exception 'service role directly mutated supplier lease';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.market_index_cohorts
      (cohort_key, version, methodology_version, effective_from, frozen_at)
    values ('service-role-direct-freeze', 1, 'supplier-first-v1', current_date, now());
    raise exception 'service role inserted a frozen market cohort';
  exception when others then
    if sqlerrm = 'service role inserted a frozen market cohort' then raise; end if;
    if position('must be inserted unfrozen' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.market_index_cohorts
    (cohort_key, version, methodology_version, effective_from)
  values ('service-role-freeze', 1, 'supplier-first-v1', current_date)
  returning id into v_service_cohort;
  insert into public.market_index_cohort_sources(cohort_id, source)
  values (v_service_cohort, 'service-role-fixture');
  begin
    update public.market_index_cohorts set frozen_at = now() where id = v_service_cohort;
    raise exception 'service role directly froze market cohort';
  exception when insufficient_privilege then
    null;
  end;
  v_service_enabled_count := public.freeze_market_index_cohort(v_service_cohort);
  select frozen_at is not null into v_service_frozen
  from public.market_index_cohorts where id = v_service_cohort;
  if v_service_enabled_count <> 1 or not v_service_frozen then
    raise exception 'service role freeze RPC did not freeze market cohort';
  end if;
  update public.market_index_cohorts set effective_to = current_date + 1
  where id = v_service_cohort;
  if (select effective_to from public.market_index_cohorts where id = v_service_cohort)
    <> current_date + 1 then
    raise exception 'service role retirement boundary was not preserved';
  end if;
end $$;
reset role;

rollback;
