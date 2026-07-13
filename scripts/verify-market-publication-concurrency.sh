#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="market_publication_contract_$$"
LOG_DIR="$(mktemp -d)"
chmod 755 "$LOG_DIR"
MIGRATION_COPY="$LOG_DIR/market-publication-foundation.sql"
cp "$ROOT/supabase/migrations/20260713_market_publication_foundation.sql" "$MIGRATION_COPY"
chmod 644 "$MIGRATION_COPY"
CREATED_ROLES=()

pg() { su postgres -c "psql -v ON_ERROR_STOP=1 -X -d '$DB' $*"; }
cleanup() {
  su postgres -c "dropdb --if-exists '$DB'" >/dev/null 2>&1 || true
  for role in "${CREATED_ROLES[@]}"; do
    su postgres -c "psql -X -d postgres -c 'drop role if exists $role'" >/dev/null 2>&1 || true
  done
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT

for role in anon authenticated service_role; do
  if ! su postgres -c "psql -X -d postgres -Atqc \"select 1 from pg_roles where rolname='$role'\"" | grep -q 1; then
    su postgres -c "psql -X -d postgres -c 'create role $role'" >/dev/null
    CREATED_ROLES+=("$role")
  fi
done

su postgres -c "createdb '$DB'"
pg "-c \"create schema auth;
  create function auth.role() returns text language sql as \\\$\\\$ select 'service_role'::text \\\$\\\$;
  create table public.coffee_catalog(id integer generated always as identity primary key, name text not null);
  insert into public.coffee_catalog(name) values ('concurrency fixture');\"" >/dev/null
pg "-f '$MIGRATION_COPY'" >/dev/null

pg "-c \"insert into public.supplier_observation_sets(id, source, observed_at, status, completeness, expected_item_count)
  values ('00000000-0000-0000-0000-000000000001', 'fixture', now(), 'partial', 'known', 1);
  insert into public.coffee_price_observations(observation_set_id, catalog_id, source, observed_at, price)
  values ('00000000-0000-0000-0000-000000000001', 1, 'fixture', now(), 10);
  insert into public.market_index_cohorts(id, cohort_key, version, methodology_version, expected_source_count, effective_from)
  values ('00000000-0000-0000-0000-000000000010', 'fixture', 1, 'v1', 1, current_date);
  insert into public.market_index_cohort_sources(cohort_id, source)
  values ('00000000-0000-0000-0000-000000000010', 'fixture');
  insert into public.market_publications(id, as_of_date, cohort_id, policy_version, methodology_version,
    expected_source_count, represented_source_count, fresh_source_count,
    represented_item_count, fresh_item_count, price_index_count, quality_tier)
  values ('00000000-0000-0000-0000-000000000020', current_date,
    '00000000-0000-0000-0000-000000000010', 'v1', 'v1', 1, 1, 1, 1, 1, 1, 'healthy');\"" >/dev/null

# Completion takes the parent lock first. A concurrent child waits, then rejects.
pg "-c \"begin;
  update public.supplier_observation_sets set status='complete', is_complete=true, observed_at=now(),
    observed_item_count=1, snapshot_item_count=1 where id='00000000-0000-0000-0000-000000000001';
  select pg_sleep(2); commit;\"" >"$LOG_DIR/set-parent.log" 2>&1 &
parent_pid=$!
sleep 0.25
started=$(date +%s%3N)
if pg "-c \"set statement_timeout='5s';
  insert into public.coffee_price_observations(observation_set_id, catalog_id, source, observed_at, price)
  values ('00000000-0000-0000-0000-000000000001', 1, 'fixture', now(), 10);\"" >"$LOG_DIR/set-child.log" 2>&1; then
  echo "Concurrency failure: child insert committed after set completion" >&2
  exit 1
fi
elapsed=$(( $(date +%s%3N) - started ))
wait "$parent_pid"
grep -q 'Complete supplier observation sets are immutable' "$LOG_DIR/set-child.log"
(( elapsed >= 1200 )) || { echo "Concurrency failure: child did not wait for parent lock (${elapsed}ms)" >&2; exit 1; }

pg "-c \"insert into public.market_publication_inputs(publication_id, source, observation_set_id, freshness, observation_age)
  values ('00000000-0000-0000-0000-000000000020', 'fixture',
    '00000000-0000-0000-0000-000000000001', 'fresh', interval '0 seconds');
  insert into public.market_publication_price_indexes(publication_id, origin, supplier_count, sample_size,
    price_min, price_max, price_avg, price_median, price_p25, price_p75, price_stdev, aggregation_tier)
  values ('00000000-0000-0000-0000-000000000020', 'Fixture', 1, 1, 10, 10, 10, 10, 10, 10, 0, 1);\"" >/dev/null

# Sealing takes the publication lock first. A concurrent artifact waits, then rejects.
pg "-c \"begin;
  update public.market_publications set status='active', sealed_at=now(), published_at=now()
    where id='00000000-0000-0000-0000-000000000020';
  select pg_sleep(2); commit;\"" >"$LOG_DIR/publication-parent.log" 2>&1 &
parent_pid=$!
sleep 0.25
started=$(date +%s%3N)
if pg "-c \"set statement_timeout='5s';
  insert into public.market_publication_price_indexes(publication_id, origin, supplier_count, sample_size,
    price_min, price_max, price_avg, price_median, price_p25, price_p75, price_stdev, aggregation_tier)
  values ('00000000-0000-0000-0000-000000000020', 'Late fixture', 1, 1, 10, 10, 10, 10, 10, 10, 0, 1);\"" >"$LOG_DIR/publication-child.log" 2>&1; then
  echo "Concurrency failure: artifact insert committed after publication sealing" >&2
  exit 1
fi
elapsed=$(( $(date +%s%3N) - started ))
wait "$parent_pid"
grep -q 'Sealed or rejected market publication artifacts are immutable' "$LOG_DIR/publication-child.log"
(( elapsed >= 1200 )) || { echo "Concurrency failure: artifact did not wait for parent lock (${elapsed}ms)" >&2; exit 1; }

echo "VALIDATION_PASS: two-session market publication lock races serialize and reject stale child writes"
