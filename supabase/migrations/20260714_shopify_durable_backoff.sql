-- Durable, fleet-wide Shopify admission state for the coffee scraper.
-- The scraper calls these RPCs directly with its service-role client. No
-- coffee-app runtime route participates in this control path.

create table public.scraper_platform_backoff (
  scope text primary key check (scope = 'shopify_fleet'),
  consecutive_rate_limited_runs bigint not null default 0
    check (consecutive_rate_limited_runs >= 0),
  next_eligible_at timestamptz,
  last_rate_limited_at timestamptz,
  last_rate_limited_source text
    check (
      last_rate_limited_source is null
      or (
        length(btrim(last_rate_limited_source)) > 0
        and last_rate_limited_source = btrim(last_rate_limited_source)
      )
    ),
  last_retry_after_seconds bigint
    check (last_retry_after_seconds is null or last_retry_after_seconds >= 0),
  last_clean_run_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check (next_eligible_at is null or last_rate_limited_at is not null)
);

insert into public.scraper_platform_backoff(scope) values ('shopify_fleet');

comment on table public.scraper_platform_backoff is
  'Mutable scraper admission state. The coffee scraper reads and transitions this fleet circuit directly through service-role RPCs.';
comment on column public.scraper_platform_backoff.next_eligible_at is
  'Database-authoritative lower bound for the next Shopify request attempt.';

create or replace function public.get_scraper_platform_backoff(p_scope text)
returns table (
  scope text,
  consecutive_rate_limited_runs bigint,
  next_eligible_at timestamptz,
  last_rate_limited_at timestamptz,
  last_rate_limited_source text,
  last_retry_after_seconds bigint,
  last_clean_run_at timestamptz,
  updated_at timestamptz,
  observed_at timestamptz,
  is_eligible boolean
) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_observed_at timestamptz := clock_timestamp();
begin
  if p_scope is distinct from 'shopify_fleet' then
    raise exception 'unsupported scraper platform backoff scope';
  end if;

  return query
  select state.scope,
    state.consecutive_rate_limited_runs,
    state.next_eligible_at,
    state.last_rate_limited_at,
    state.last_rate_limited_source,
    state.last_retry_after_seconds,
    state.last_clean_run_at,
    state.updated_at,
    v_observed_at,
    state.next_eligible_at is null or state.next_eligible_at <= v_observed_at
  from public.scraper_platform_backoff state
  where state.scope = p_scope;

  if not found then
    raise exception 'scraper platform backoff state is missing';
  end if;
end $$;

-- Deterministic implementation seam for database contract tests. Runtime
-- callers cannot execute this function; the public wrapper supplies database
-- time and randomized positive jitter.
create or replace function public._record_scraper_platform_rate_limit(
  p_scope text,
  p_source text,
  p_retry_after_seconds bigint,
  p_observed_at timestamptz,
  p_jitter_seconds bigint
) returns table (
  scope text,
  consecutive_rate_limited_runs bigint,
  next_eligible_at timestamptz,
  last_rate_limited_at timestamptz,
  last_rate_limited_source text,
  last_retry_after_seconds bigint,
  last_clean_run_at timestamptz,
  updated_at timestamptz,
  observed_at timestamptz,
  effective_delay_seconds bigint,
  is_eligible boolean
) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_state public.scraper_platform_backoff%rowtype;
  v_new_strikes bigint;
  v_exponential_seconds bigint;
  v_jitter_ceiling_seconds bigint;
  v_jitter_seconds bigint;
  v_local_delay_seconds bigint;
  v_effective_delay_seconds bigint;
  v_next_eligible_at timestamptz;
begin
  if p_scope is distinct from 'shopify_fleet' then
    raise exception 'unsupported scraper platform backoff scope';
  end if;
  if p_source is null or p_source = '' or p_source <> btrim(p_source) then
    raise exception 'source must be a non-empty canonical source key';
  end if;
  if p_retry_after_seconds is not null
    and (p_retry_after_seconds < 0 or p_retry_after_seconds > 3155760000) then
    raise exception 'Retry-After seconds must be between zero and 100 years';
  end if;
  if p_observed_at is null then
    raise exception 'observation time is required';
  end if;

  select state.* into strict v_state
  from public.scraper_platform_backoff state
  where state.scope = p_scope
  for update;

  if v_state.consecutive_rate_limited_runs = 9223372036854775807 then
    raise exception 'rate-limited run counter exhausted';
  end if;
  v_new_strikes := v_state.consecutive_rate_limited_runs + 1;

  -- 5m, 10m, 20m, ... 21h20m, 42h40m, then 48h capped.
  if v_new_strikes >= 11 then
    v_exponential_seconds := 172800;
  else
    v_exponential_seconds := 300 * power(2::numeric, v_new_strikes - 1)::bigint;
  end if;

  -- Add 1-10% positive jitter, capped at five minutes, before the local
  -- component is capped at 48 hours. Tests may supply a value in this range.
  v_jitter_ceiling_seconds := greatest(
    1,
    least(300, ceil(v_exponential_seconds::numeric / 10)::bigint)
  );
  if p_jitter_seconds is not null
    and (p_jitter_seconds < 1 or p_jitter_seconds > v_jitter_ceiling_seconds) then
    raise exception 'jitter seconds must be within the production jitter range';
  end if;
  v_jitter_seconds := coalesce(
    p_jitter_seconds,
    1 + floor(random() * v_jitter_ceiling_seconds)::bigint
  );
  v_local_delay_seconds := least(
    172800,
    v_exponential_seconds + v_jitter_seconds
  );
  v_effective_delay_seconds := greatest(
    v_local_delay_seconds,
    coalesce(p_retry_after_seconds, 0)
  );
  v_next_eligible_at := greatest(
    coalesce(v_state.next_eligible_at, '-infinity'::timestamptz),
    p_observed_at + make_interval(secs => v_effective_delay_seconds::double precision)
  );

  update public.scraper_platform_backoff state
  set consecutive_rate_limited_runs = v_new_strikes,
      next_eligible_at = v_next_eligible_at,
      last_rate_limited_at = p_observed_at,
      last_rate_limited_source = p_source,
      last_retry_after_seconds = p_retry_after_seconds,
      updated_at = p_observed_at
  where state.scope = p_scope
  returning state.* into strict v_state;

  return query
  select v_state.scope,
    v_state.consecutive_rate_limited_runs,
    v_state.next_eligible_at,
    v_state.last_rate_limited_at,
    v_state.last_rate_limited_source,
    v_state.last_retry_after_seconds,
    v_state.last_clean_run_at,
    v_state.updated_at,
    p_observed_at,
    v_effective_delay_seconds,
    false;
end $$;

create or replace function public.record_scraper_platform_rate_limit(
  p_scope text,
  p_source text,
  p_retry_after_seconds bigint default null
) returns table (
  scope text,
  consecutive_rate_limited_runs bigint,
  next_eligible_at timestamptz,
  last_rate_limited_at timestamptz,
  last_rate_limited_source text,
  last_retry_after_seconds bigint,
  last_clean_run_at timestamptz,
  updated_at timestamptz,
  observed_at timestamptz,
  effective_delay_seconds bigint,
  is_eligible boolean
) language sql security definer
set search_path = public, pg_temp as $$
  select * from public._record_scraper_platform_rate_limit(
    p_scope,
    p_source,
    p_retry_after_seconds,
    clock_timestamp(),
    null
  );
$$;

create or replace function public.reset_scraper_platform_backoff(p_scope text)
returns table (
  scope text,
  consecutive_rate_limited_runs bigint,
  next_eligible_at timestamptz,
  last_rate_limited_at timestamptz,
  last_rate_limited_source text,
  last_retry_after_seconds bigint,
  last_clean_run_at timestamptz,
  updated_at timestamptz,
  observed_at timestamptz,
  is_eligible boolean
) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_observed_at timestamptz := clock_timestamp();
  v_state public.scraper_platform_backoff%rowtype;
begin
  if p_scope is distinct from 'shopify_fleet' then
    raise exception 'unsupported scraper platform backoff scope';
  end if;

  update public.scraper_platform_backoff state
  set consecutive_rate_limited_runs = 0,
      next_eligible_at = null,
      last_clean_run_at = v_observed_at,
      updated_at = v_observed_at
  where state.scope = p_scope
  returning state.* into strict v_state;

  return query
  select v_state.scope,
    v_state.consecutive_rate_limited_runs,
    v_state.next_eligible_at,
    v_state.last_rate_limited_at,
    v_state.last_rate_limited_source,
    v_state.last_retry_after_seconds,
    v_state.last_clean_run_at,
    v_state.updated_at,
    v_observed_at,
    true;
exception
  when no_data_found then
    raise exception 'scraper platform backoff state is missing';
end $$;

alter table public.scraper_platform_backoff enable row level security;
revoke all on table public.scraper_platform_backoff
  from public, anon, authenticated, service_role;
grant select on table public.scraper_platform_backoff to service_role;
create policy "Service role reads scraper_platform_backoff"
  on public.scraper_platform_backoff
  for select using (auth.role() = 'service_role');

revoke all on function public.get_scraper_platform_backoff(text)
  from public, anon, authenticated;
grant execute on function public.get_scraper_platform_backoff(text) to service_role;
revoke all on function public.record_scraper_platform_rate_limit(text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.record_scraper_platform_rate_limit(text, text, bigint)
  to service_role;
revoke all on function public.reset_scraper_platform_backoff(text)
  from public, anon, authenticated;
grant execute on function public.reset_scraper_platform_backoff(text) to service_role;
revoke all on function public._record_scraper_platform_rate_limit(
  text, text, bigint, timestamptz, bigint
) from public, anon, authenticated, service_role;
