-- Executable behavior contract for durable Shopify fleet admission state.
begin;

do $$
declare
  v_state record;
  v_observed_at constant timestamptz := '2026-07-14 12:00:00+00';
  v_expected_delays constant bigint[] := array[
    301, 601, 1201, 2401, 4801, 9601, 19201, 38401, 76801, 153601, 172800
  ];
  v_expected_delay bigint;
begin
  select * into strict v_state
  from public.get_scraper_platform_backoff('shopify_fleet');
  if v_state.consecutive_rate_limited_runs <> 0
    or v_state.next_eligible_at is not null
    or not v_state.is_eligible then
    raise exception 'initial Shopify fleet state was not eligible with zero strikes';
  end if;

  foreach v_expected_delay in array v_expected_delays loop
    select * into strict v_state
    from public._record_scraper_platform_rate_limit(
      'shopify_fleet',
      'contract-source',
      null,
      v_observed_at,
      1
    );
    if v_state.effective_delay_seconds <> v_expected_delay then
      raise exception 'exponential delay progression was not preserved';
    end if;
    if v_state.next_eligible_at <> v_observed_at
      + make_interval(secs => v_expected_delay::double precision) then
      raise exception 'next eligible timestamp did not use database transition time';
    end if;
  end loop;
  if v_state.consecutive_rate_limited_runs <> 11 then
    raise exception 'rate-limited run counter did not advance atomically';
  end if;

  perform public.reset_scraper_platform_backoff('shopify_fleet', 11);
  select * into strict v_state
  from public._record_scraper_platform_rate_limit(
    'shopify_fleet', 'retry-after-low', 60, v_observed_at, 1
  );
  if v_state.effective_delay_seconds <> 301 then
    raise exception 'short Retry-After reduced the local exponential delay';
  end if;

  perform public.reset_scraper_platform_backoff('shopify_fleet', 1);
  select * into strict v_state
  from public._record_scraper_platform_rate_limit(
    'shopify_fleet', 'retry-after-high', 200000, v_observed_at, 1
  );
  if v_state.effective_delay_seconds <> 200000
    or v_state.next_eligible_at <> v_observed_at + interval '200000 seconds' then
    raise exception 'Retry-After above 48 hours was not honored';
  end if;

  select * into strict v_state
  from public._record_scraper_platform_rate_limit(
    'shopify_fleet', 'retry-after-followup', null, v_observed_at + interval '1 second', 1
  );
  if v_state.next_eligible_at <> v_observed_at + interval '200000 seconds' then
    raise exception 'later transition shortened an existing cooldown';
  end if;

  select * into strict v_state
  from public.reset_scraper_platform_backoff('shopify_fleet', 2);
  if v_state.consecutive_rate_limited_runs <> 0
    or v_state.next_eligible_at is not null
    or v_state.last_clean_run_at is null
    or not v_state.is_eligible
    or not v_state.reset_applied then
    raise exception 'clean-run reset did not clear strikes and eligibility';
  end if;
  if v_state.last_rate_limited_source <> 'retry-after-followup' then
    raise exception 'clean-run reset erased diagnostic rate-limit history';
  end if;

  select * into strict v_state
  from public._record_scraper_platform_rate_limit(
    'shopify_fleet', 'newer-rate-limit', null, v_observed_at, 1
  );
  select * into strict v_state
  from public.reset_scraper_platform_backoff('shopify_fleet', 0);
  if v_state.reset_applied
    or v_state.consecutive_rate_limited_runs <> 1
    or v_state.next_eligible_at is null then
    raise exception 'stale clean-run generation erased a newer rate limit';
  end if;
  perform public.reset_scraper_platform_backoff('shopify_fleet', 1);

  begin
    perform public.get_scraper_platform_backoff('other_fleet');
    raise exception 'unsupported scope was accepted';
  exception when others then
    if sqlerrm = 'unsupported scope was accepted' then raise; end if;
    if position('unsupported scraper platform backoff scope' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    perform public._record_scraper_platform_rate_limit(
      'shopify_fleet', 'bad-source ', null, v_observed_at, 1
    );
    raise exception 'non-canonical source was accepted';
  exception when others then
    if sqlerrm = 'non-canonical source was accepted' then raise; end if;
    if position('canonical source key' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    perform public._record_scraper_platform_rate_limit(
      'shopify_fleet', 'contract-source', -1, v_observed_at, 1
    );
    raise exception 'negative Retry-After was accepted';
  exception when others then
    if sqlerrm = 'negative Retry-After was accepted' then raise; end if;
    if position('Retry-After seconds' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.scraper_platform_backoff', 'SELECT')
    or has_table_privilege('authenticated', 'public.scraper_platform_backoff', 'SELECT') then
    raise exception 'anonymous or authenticated role can read backoff state';
  end if;
  if has_table_privilege('service_role', 'public.scraper_platform_backoff', 'SELECT')
    or has_table_privilege('service_role', 'public.scraper_platform_backoff', 'INSERT')
    or has_table_privilege('service_role', 'public.scraper_platform_backoff', 'UPDATE')
    or has_table_privilege('service_role', 'public.scraper_platform_backoff', 'DELETE')
    or has_table_privilege('service_role', 'public.scraper_platform_backoff', 'TRUNCATE') then
    raise exception 'service role can directly mutate backoff state';
  end if;
  if has_function_privilege(
    'anon', 'public.record_scraper_platform_rate_limit(text,text,bigint)', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated', 'public.record_scraper_platform_rate_limit(text,text,bigint)', 'EXECUTE'
  ) then
    raise exception 'non-service role can execute rate-limit transition';
  end if;
  if not has_function_privilege(
    'service_role', 'public.record_scraper_platform_rate_limit(text,text,bigint)', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.get_scraper_platform_backoff(text)', 'EXECUTE'
  ) or not has_function_privilege(
    'service_role', 'public.reset_scraper_platform_backoff(text,bigint)', 'EXECUTE'
  ) then
    raise exception 'service role cannot execute public backoff RPCs';
  end if;
  if has_function_privilege(
    'service_role',
    'public._record_scraper_platform_rate_limit(text,text,bigint,timestamptz,bigint)',
    'EXECUTE'
  ) then
    raise exception 'service role can execute deterministic test seam';
  end if;
end $$;

set local role service_role;
do $$
declare
  v_state record;
begin
  select * into strict v_state
  from public.record_scraper_platform_rate_limit(
    'shopify_fleet', 'service-role-source', null
  );
  if v_state.consecutive_rate_limited_runs <> 1
    or v_state.effective_delay_seconds < 301
    or v_state.effective_delay_seconds > 330
    or v_state.is_eligible then
    raise exception 'service-role rate-limit RPC did not enforce first-strike delay';
  end if;

  begin
    update public.scraper_platform_backoff
    set consecutive_rate_limited_runs = 0
    where scope = 'shopify_fleet';
    raise exception 'service role directly updated backoff state';
  exception when insufficient_privilege then
    null;
  end;

  select * into strict v_state
  from public.reset_scraper_platform_backoff('shopify_fleet', 1);
  if v_state.consecutive_rate_limited_runs <> 0
    or not v_state.is_eligible
    or not v_state.reset_applied then
    raise exception 'service-role clean reset RPC did not restore eligibility';
  end if;
end $$;
reset role;

rollback;
