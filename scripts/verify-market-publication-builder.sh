#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="market_publication_builder_$$"
TMP="$(mktemp -d)"; chmod 755 "$TMP"
cp "$ROOT"/supabase/migrations/20260713_market_publication_foundation.sql \
  "$ROOT"/supabase/migrations/20260714_01_market_publication_builder.sql \
  "$ROOT"/supabase/tests/market_publication_builder.sql "$TMP/"
chmod 644 "$TMP"/*
cleanup(){ su postgres -c "dropdb --if-exists '$DB'" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
for role in anon authenticated service_role; do
  su postgres -c "psql -X -d postgres -Atqc \"select 1 from pg_roles where rolname='$role'\"" | grep -q 1 || su postgres -c "createuser '$role'"
done
su postgres -c "createdb '$DB'"
pg(){ su postgres -c "psql -v ON_ERROR_STOP=1 -X -d '$DB' $*"; }
pg "-c \"create schema auth; create function auth.role() returns text language sql as \\\$\\\$ select 'service_role'::text \\\$\\\$;
  create table public.coffee_catalog(id integer generated always as identity primary key, name text not null);\"" >/dev/null
mapfile -t migrations < <(find "$TMP" -maxdepth 1 -name '202*.sql' -print | sort)
[[ "$(basename "${migrations[0]}")" == "20260713_market_publication_foundation.sql" ]] || {
  echo "Replay failure: foundation migration was not first" >&2
  exit 1
}
[[ "$(basename "${migrations[1]}")" == "20260714_01_market_publication_builder.sql" ]] || {
  echo "Replay failure: builder migration was not second" >&2
  exit 1
}
for migration in "${migrations[@]}"; do pg "-f '$migration'" >/dev/null; done
pg "-f '$TMP/market_publication_builder.sql'" >/dev/null

# Competing supplier captures must serialize on the lease row. The waiter sees
# the committed live owner and returns no fence rather than creating a hybrid set.
pg "-c \"insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values
    ('30000000-0000-0000-0000-000000000001','lease-one',1,1),
    ('30000000-0000-0000-0000-000000000002','lease-two',1,1);\"" >/dev/null
pg "-Atc \"begin;
  select public.acquire_supplier_scrape_lease('lease-source','30000000-0000-0000-0000-000000000001');
  select pg_sleep(2);
  commit;\"" >"$TMP/first-lease.log" 2>&1 &
first_pid=$!
sleep 0.25
started=$(date +%s%3N)
pg "-Atc \"set statement_timeout='5s';
  select public.acquire_supplier_scrape_lease('lease-source','30000000-0000-0000-0000-000000000002');\"" >"$TMP/waiting-lease.log" 2>&1
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"
grep -Eq '^[0-9]+$' "$TMP/first-lease.log"
if grep -Eq '^[0-9]+$' "$TMP/waiting-lease.log"; then
  echo "Concurrency failure: live lease returned a fencing token to its waiter" >&2
  exit 1
fi
(( elapsed >= 1200 )) || { echo "Concurrency failure: competing supplier lease did not wait (${elapsed}ms)" >&2; exit 1; }
lease_fence=$(grep -E '^[0-9]+$' "$TMP/first-lease.log" | head -1)
released=$(pg "-Atqc \"select public.release_supplier_scrape_lease(
  'lease-source','30000000-0000-0000-0000-000000000001',$lease_fence);\"")
[[ "$released" == "t" ]] || { echo "Concurrency failure: lease owner could not release" >&2; exit 1; }

# Two concurrent builders for the same date/cohort must serialize. The first
# promotes a whole publication and the waiter must compare against it and
# reject its equal candidate, leaving exactly one active publication.
pg "-c \"insert into public.coffee_catalog(name) values ('concurrency-fixture');
  insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values ('20000000-0000-0000-0000-000000000010','builder-concurrency',1,1);
  insert into public.market_index_cohorts(id,cohort_key,version,methodology_version,expected_source_count,effective_from)
  values ('20000000-0000-0000-0000-000000000001','builder-concurrency',1,'supplier-first-matched-relative-v1',1,'2026-07-01');
  insert into public.market_index_cohort_sources(cohort_id,source,carry_forward_ttl,source_weight)
  values ('20000000-0000-0000-0000-000000000001','only-source',interval '3 days',1);
  insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,
    observed_item_count,snapshot_item_count,is_complete)
  values ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000010',
    public.acquire_supplier_scrape_lease('only-source','20000000-0000-0000-0000-000000000010'),
    'only-source','2026-07-13 12:00Z','partial','known',1,1,1,false);
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
  select '21000000-0000-0000-0000-000000000001',max(id),'only-source','2026-07-13 12:00Z',12,true,false,'Peru'
  from public.coffee_catalog;
  update public.supplier_observation_sets set status='complete',is_complete=true
  where id='21000000-0000-0000-0000-000000000001';\"" >/dev/null

pg "-c \"begin;
  select id from public.market_index_cohorts
  where id='20000000-0000-0000-0000-000000000001' for update;
  select pg_sleep(2);
  select * from public.build_market_publication('2026-07-13','builder-concurrency',1);
  commit;\"" >"$TMP/first-builder.log" 2>&1 &
first_pid=$!
sleep 0.25
started=$(date +%s%3N)
pg "-c \"set statement_timeout='5s';
  select * from public.build_market_publication('2026-07-13','builder-concurrency',1);\"" >"$TMP/waiting-builder.log" 2>&1
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"
grep -q 'activated' "$TMP/first-builder.log"
grep -q 'rejected_not_better' "$TMP/waiting-builder.log"
(( elapsed >= 1200 )) || { echo "Concurrency failure: competing builder did not wait (${elapsed}ms)" >&2; exit 1; }
active_count=$(pg "-Atqc \"select count(*) from public.market_publications
  where cohort_id='20000000-0000-0000-0000-000000000001' and as_of_date='2026-07-13' and status='active';\"")
candidate_count=$(pg "-Atqc \"select count(*) from public.market_publications
  where cohort_id='20000000-0000-0000-0000-000000000001' and as_of_date='2026-07-13';\"")
[[ "$active_count" == "1" && "$candidate_count" == "2" ]] || {
  echo "Concurrency failure: expected one active of two whole candidates, got active=$active_count total=$candidate_count" >&2
  exit 1
}

# Adjacent-date builds use the same cohort lock. Once day two commits with day
# one as its predecessor, a waiting day-one rebuild must preserve that chain.
only_source_fence=$(pg "-Atqc \"select fence from public.supplier_scrape_leases where source='only-source';\"")
pg "-c \"select public.release_supplier_scrape_lease('only-source',
    '20000000-0000-0000-0000-000000000010',$only_source_fence);
  insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values ('20000000-0000-0000-0000-000000000011','builder-adjacent',1,1);
  insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,
    expected_item_count,observed_item_count,snapshot_item_count,is_complete)
  values ('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000011',
    public.acquire_supplier_scrape_lease('only-source','20000000-0000-0000-0000-000000000011'),
    'only-source','2026-07-14 12:00Z','partial','known',1,1,1,false);
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
  select '21000000-0000-0000-0000-000000000002',max(id),'only-source','2026-07-14 12:00Z',13,true,false,'Peru'
  from public.coffee_catalog;
  update public.supplier_observation_sets set status='complete',is_complete=true
  where id='21000000-0000-0000-0000-000000000002';\"" >/dev/null
pg "-c \"begin;
  select id from public.market_index_cohorts
  where id='20000000-0000-0000-0000-000000000001' for update;
  select pg_sleep(2);
  select * from public.build_market_publication('2026-07-14','builder-concurrency',1);
  commit;\"" >"$TMP/adjacent-day-two.log" 2>&1 &
first_pid=$!
sleep 0.25
started=$(date +%s%3N)
pg "-c \"set statement_timeout='5s';
  select * from public.build_market_publication('2026-07-13','builder-concurrency',1);\"" >"$TMP/adjacent-day-one.log" 2>&1
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"
grep -q 'activated' "$TMP/adjacent-day-two.log"
grep -q 'rejected_chain_finalized' "$TMP/adjacent-day-one.log"
(( elapsed >= 1200 )) || { echo "Concurrency failure: adjacent builder did not wait (${elapsed}ms)" >&2; exit 1; }

# A cohort-source mutation locks the cohort parent through its guard trigger.
# If a builder wins that parent lock, the mutation waits and then rejects once
# the publication freezes the cohort; it cannot leak half-new weights or TTLs.
pg "-c \"insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
  values ('40000000-0000-0000-0000-000000000010','builder-config-lock',1,1);
  insert into public.market_index_cohorts(id,cohort_key,version,methodology_version,expected_source_count,effective_from)
  values ('40000000-0000-0000-0000-000000000001','builder-config-lock',1,'supplier-first-matched-relative-v1',1,'2026-07-01');
  insert into public.market_index_cohort_sources(cohort_id,source,carry_forward_ttl,source_weight)
  values ('40000000-0000-0000-0000-000000000001','config-source',interval '3 days',1);
  insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,
    expected_item_count,observed_item_count,snapshot_item_count,is_complete)
  values ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000010',
    public.acquire_supplier_scrape_lease('config-source','40000000-0000-0000-0000-000000000010'),
    'config-source','2026-07-13 12:00Z','partial','known',1,1,1,false);
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
  select '41000000-0000-0000-0000-000000000001',max(id),'config-source','2026-07-13 12:00Z',15,true,false,'Kenya'
  from public.coffee_catalog;
  update public.supplier_observation_sets set status='complete',is_complete=true
  where id='41000000-0000-0000-0000-000000000001';\"" >/dev/null
pg "-c \"begin;
  select id from public.market_index_cohorts
  where id='40000000-0000-0000-0000-000000000001' for update;
  select pg_sleep(2);
  select * from public.build_market_publication('2026-07-13','builder-config-lock',1);
  commit;\"" >"$TMP/config-builder.log" 2>&1 &
first_pid=$!
sleep 0.25
started=$(date +%s%3N)
if pg "-c \"set statement_timeout='5s';
  update public.market_index_cohort_sources set source_weight=2,carry_forward_ttl=interval '4 days'
  where cohort_id='40000000-0000-0000-0000-000000000001' and source='config-source';\"" >"$TMP/config-mutation.log" 2>&1; then
  echo "Concurrency failure: source configuration mutated across publication construction" >&2
  exit 1
fi
elapsed=$(( $(date +%s%3N) - started ))
wait "$first_pid"
grep -q 'activated' "$TMP/config-builder.log"
grep -q 'Published cohort membership is immutable' "$TMP/config-mutation.log"
(( elapsed >= 1200 )) || { echo "Concurrency failure: source mutation did not wait for cohort parent (${elapsed}ms)" >&2; exit 1; }
config_snapshot=$(pg "-Atqc \"select segment.source_weight || ':' || source.source_weight || ':' || source.carry_forward_ttl
  from public.market_publication_supplier_segments segment
  join public.market_publications publication on publication.id=segment.publication_id
  join public.market_index_cohort_sources source on source.cohort_id=publication.cohort_id and source.source=segment.source
  where publication.cohort_id='40000000-0000-0000-0000-000000000001' and publication.status='active';\"")
[[ "$config_snapshot" == "1.000000:1.000000:3 days" ]] || {
  echo "Concurrency failure: publication/config snapshot was incoherent ($config_snapshot)" >&2
  exit 1
}

echo "VALIDATION_PASS: fenced leases, sorted replay, lifecycle guards, publication promotion, and cohort-config serialization"
