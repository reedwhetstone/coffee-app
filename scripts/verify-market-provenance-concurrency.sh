#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="market_provenance_concurrency_$$"
LOG_DIR="$(mktemp -d)"
chmod 755 "$LOG_DIR"
cp "$ROOT/supabase/migrations/20260713_market_publication_foundation.sql" "$LOG_DIR/migration.sql"
chmod 644 "$LOG_DIR/migration.sql"
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
  if ! su postgres -c "psql -X -d postgres -Atqc \"select 1 from pg_roles where rolname='$role'\"" | rg -q 1; then
    su postgres -c "psql -X -d postgres -c 'create role $role'" >/dev/null
    CREATED_ROLES+=("$role")
  fi
done

su postgres -c "createdb '$DB'"
pg "-c \"create schema auth;
  create function auth.role() returns text language sql as \\\$\\\$ select 'service_role'::text \\\$\\\$;
  create table public.coffee_catalog(id integer generated always as identity primary key, name text not null);
  insert into public.coffee_catalog(name) values ('concurrency fixture');\"" >/dev/null
pg "-f '$LOG_DIR/migration.sql'" >/dev/null

pg "-c \"insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values ('00000000-0000-0000-0000-000000000001','concurrency scrape',1,1);
  select public.acquire_supplier_scrape_lease('fixture','00000000-0000-0000-0000-000000000001',interval '1 hour');
  insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,expected_item_count)
  values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',1,'fixture',now(),'partial',1);
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price)
  select '00000000-0000-0000-0000-000000000002',1,'fixture',observed_at,10
  from public.supplier_observation_sets where id='00000000-0000-0000-0000-000000000002';
  update public.supplier_scrape_leases set acquired_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'
  where source='fixture';\"" >/dev/null

# Reacquisition locks run then lease and holds both. Seal follows the same
# order, waits, then rejects its stale fence rather than deadlocking.
pg "-c \"begin;
  select public.acquire_supplier_scrape_lease('fixture','00000000-0000-0000-0000-000000000001',interval '1 hour');
  select pg_sleep(2); commit;\"" >"$LOG_DIR/reacquire.log" 2>&1 &
reacquire_pid=$!
sleep 0.25
started=$(date +%s%3N)
if pg "-c \"set statement_timeout='5s';
  select public.seal_supplier_observation_set('00000000-0000-0000-0000-000000000002',1,1,1);\"" \
  >"$LOG_DIR/seal.log" 2>&1; then
  echo "Concurrency failure: stale fence sealed after reacquisition" >&2
  exit 1
fi
elapsed=$(( $(date +%s%3N) - started ))
wait "$reacquire_pid"
rg -q 'live fenced supplier lease' "$LOG_DIR/seal.log"
(( elapsed >= 1200 )) || {
  echo "Concurrency failure: seal did not wait for run/lease locks (${elapsed}ms)" >&2
  exit 1
}

echo "VALIDATION_PASS: lease reacquisition and sealing share run -> lease lock order without deadlock"

# A writer that inserts observations and seals in the same transaction takes
# the run lock inside the child-write trigger, so a concurrent duplicate
# sealer queues at the run instead of holding run -> lease while waiting on
# the writer's set row (the inverse-order deadlock).
pg "-c \"insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values ('00000000-0000-0000-0000-000000000011','writer seal scrape',1,1);
  select public.acquire_supplier_scrape_lease('fixture2','00000000-0000-0000-0000-000000000011',interval '1 hour');
  insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,expected_item_count)
  select '00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000011',lease.fence,'fixture2',now(),'partial',1
  from public.supplier_scrape_leases lease where lease.source='fixture2';\"" >/dev/null

pg "-c \"begin;
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price)
  select '00000000-0000-0000-0000-000000000012',1,'fixture2',observed_at,12
  from public.supplier_observation_sets where id='00000000-0000-0000-0000-000000000012';
  select pg_sleep(2);
  select public.seal_supplier_observation_set('00000000-0000-0000-0000-000000000012',
    (select fence from public.supplier_scrape_leases where source='fixture2'),1,1);
  commit;\"" >"$LOG_DIR/writer_seal.log" 2>&1 &
writer_pid=$!
sleep 0.25
started=$(date +%s%3N)
if pg "-c \"set statement_timeout='5s';
  select public.seal_supplier_observation_set('00000000-0000-0000-0000-000000000012',
    (select fence from public.supplier_scrape_leases where source='fixture2'),1,1);\"" \
  >"$LOG_DIR/duplicate_seal.log" 2>&1; then
  echo "Concurrency failure: duplicate sealer completed an already-sealed set" >&2
  exit 1
fi
elapsed=$(( $(date +%s%3N) - started ))
# The writer's exit code is judged from its log below so a deadlock abort
# produces the diagnostic instead of a silent set -e exit.
wait "$writer_pid" || true
if rg -q 'deadlock detected' "$LOG_DIR/writer_seal.log" "$LOG_DIR/duplicate_seal.log"; then
  echo "Concurrency failure: same-transaction write+seal deadlocked against duplicate sealer" >&2
  exit 1
fi
if rg -q 'ERROR' "$LOG_DIR/writer_seal.log"; then
  echo "Concurrency failure: writer transaction did not seal its own observation set" >&2
  cat "$LOG_DIR/writer_seal.log" >&2
  exit 1
fi
rg -q 'Complete supplier observation sets are immutable' "$LOG_DIR/duplicate_seal.log"
su postgres -c "psql -X -d '$DB' -Atqc \"select is_complete from public.supplier_observation_sets
  where id='00000000-0000-0000-0000-000000000012'\"" | rg -q '^t$'
(( elapsed >= 1200 )) || {
  echo "Concurrency failure: duplicate sealer did not queue at the run lock (${elapsed}ms)" >&2
  exit 1
}

echo "VALIDATION_PASS: same-transaction observation writes and sealing queue duplicate sealers at the run lock"
