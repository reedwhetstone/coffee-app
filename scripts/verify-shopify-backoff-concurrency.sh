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

pg "-c \"begin;
  select * from public.record_scraper_platform_rate_limit(
    'shopify_fleet','concurrency-a',null
  );
  select pg_sleep(2);
  commit;\"" >"$LOG_DIR/first.log" 2>&1 &
first_pid=$!
sleep 0.25

started=$(date +%s%3N)
pg "-c \"set statement_timeout='5s';
  select * from public.record_scraper_platform_rate_limit(
    'shopify_fleet','concurrency-b',null
  );\"" >"$LOG_DIR/second.log" 2>&1
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"

state=$(pg "-Atqc \"select consecutive_rate_limited_runs || '|' ||
  extract(epoch from (next_eligible_at - last_rate_limited_at))::bigint
  from public.scraper_platform_backoff where scope='shopify_fleet'\"")
strike_count="${state%%|*}"
delay_seconds="${state##*|}"
[[ "$strike_count" == "2" ]] && (( delay_seconds >= 601 && delay_seconds <= 660 )) || {
  echo "Concurrency failure: expected serialized count 2 and second-strike delay 601-660s, got $state" >&2
  exit 1
}
(( elapsed >= 1200 )) || {
  echo "Concurrency failure: second transition did not wait for the row lock (${elapsed}ms)" >&2
  exit 1
}

pg "-c \"select * from public.reset_scraper_platform_backoff('shopify_fleet', 2);\"" >/dev/null

# A clean run admitted at generation zero must not erase a newer 429 that wins
# the row lock while that clean run is finishing.
pg "-c \"begin;
  select * from public.record_scraper_platform_rate_limit(
    'shopify_fleet','newer-rate-limit',null
  );
  select pg_sleep(2);
  commit;\"" >"$LOG_DIR/newer-rate-limit.log" 2>&1 &
rate_limit_pid=$!
sleep 0.25

started=$(date +%s%3N)
reset_result=$(pg "-Atqc \"set statement_timeout='5s';
  select reset_applied || '|' || consecutive_rate_limited_runs
  from public.reset_scraper_platform_backoff('shopify_fleet', 0)\"")
elapsed=$(( $(date +%s%3N) - started ))
wait "$rate_limit_pid"
[[ "$reset_result" == "false|1" ]] || {
  echo "Concurrency failure: stale clean reset erased or misreported a newer 429 ($reset_result)" >&2
  exit 1
}
(( elapsed >= 1200 )) || {
  echo "Concurrency failure: stale reset did not wait for the row lock (${elapsed}ms)" >&2
  exit 1
}

echo "VALIDATION_PASS: concurrent transitions serialize and stale clean resets cannot erase newer 429s"
