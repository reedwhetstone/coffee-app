#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="shopify_backoff_concurrency_$$"
LOG_DIR="$(mktemp -d)"
CREATED_ROLES=()
chmod 755 "$LOG_DIR"
cp "$ROOT/supabase/migrations/20260714_shopify_durable_backoff.sql" "$LOG_DIR/migration.sql"
cp "$ROOT/supabase/tests/shopify_durable_backoff.sql" "$LOG_DIR/behavior.sql"
chmod 644 "$LOG_DIR/migration.sql" "$LOG_DIR/behavior.sql"

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
  create function auth.role() returns text language sql stable as \\\$\\\$ select current_user::text \\\$\\\$;\"" >/dev/null
pg "-f '$LOG_DIR/migration.sql'" >/dev/null
pg "-f '$LOG_DIR/behavior.sql'" >/dev/null

OBSERVED_AT="2026-07-14 12:00:00+00"
pg "-c \"begin;
  select * from public._record_scraper_platform_rate_limit(
    'shopify_fleet','concurrency-a',null,'$OBSERVED_AT',1
  );
  select pg_sleep(2);
  commit;\"" >"$LOG_DIR/first.log" 2>&1 &
first_pid=$!
sleep 0.25

started=$(date +%s%3N)
pg "-c \"set statement_timeout='5s';
  select * from public._record_scraper_platform_rate_limit(
    'shopify_fleet','concurrency-b',null,'$OBSERVED_AT',1
  );\"" >"$LOG_DIR/second.log" 2>&1
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"

state=$(pg "-Atqc \"select consecutive_rate_limited_runs || '|' ||
  extract(epoch from (next_eligible_at - '$OBSERVED_AT'::timestamptz))::bigint
  from public.scraper_platform_backoff where scope='shopify_fleet'\"")
[[ "$state" == "2|601" ]] || {
  echo "Concurrency failure: expected serialized state 2|601, got $state" >&2
  exit 1
}
(( elapsed >= 1200 )) || {
  echo "Concurrency failure: second transition did not wait for the row lock (${elapsed}ms)" >&2
  exit 1
}

echo "VALIDATION_PASS: concurrent Shopify rate-limit transitions serialize without lost increments"
