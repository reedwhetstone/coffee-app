import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(
	fileURLToPath(
		new URL('../supabase/migrations/20260713_market_publication_foundation.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const behaviorTests = readFileSync(
	fileURLToPath(new URL('../supabase/tests/market_publication_foundation.sql', import.meta.url)),
	'utf8'
).toLowerCase();

const required = [
	'scrape_runs',
	'supplier_scrape_leases',
	'supplier_observation_sets',
	'coffee_price_observations',
	'market_index_cohorts',
	'market_index_cohort_sources'
];
for (const table of required) {
	if (!migration.includes(`create table public.${table}`))
		throw new Error(`Missing table ${table}`);
}

for (const forbidden of [
	'create table public.market_publications',
	'create table public.market_publication_inputs',
	'create table public.market_publication_price_indexes',
	'activate_market_publication',
	'build_market_publication',
	'guard_market_publication_lifecycle'
]) {
	if (migration.includes(forbidden)) throw new Error(`Forbidden activating contract: ${forbidden}`);
}

for (const invariant of [
	"publication_scope text not null default 'non-production'",
	"publication_scope in ('production', 'non-production')",
	'create view public.market_index_cohort_enabled_counts',
	"daterange(effective_from, effective_to, '[)') with &&",
	'acquire_supplier_scrape_lease',
	'release_supplier_scrape_lease',
	'freeze_market_index_cohort',
	'guard_scrape_run_lifecycle',
	'zero-result supplier capture is a failure',
	'new.frozen_at is distinct from old.frozen_at',
	'revoke all on table public.supplier_scrape_leases from public, anon, authenticated, service_role',
	'grant select on table public.supplier_scrape_leases to service_role',
	'frozen market cohort membership is immutable',
	'retired market cohort boundary is immutable',
	'revoke all on table public.%i from public, anon, authenticated',
	'grant all on table public.%i to service_role'
]) {
	if (!migration.includes(invariant)) throw new Error(`Missing migration invariant: ${invariant}`);
}

if (/expected_source_count|carry_forward_ttl/.test(migration)) {
	throw new Error('Foundation must not store drift-prone cardinality or short carry-forward TTL');
}

for (const scenario of [
	'publication storage exists in provenance-only foundation',
	'scrape run did not default to non-production',
	'live supplier lease was stolen',
	'same-run expired lease reacquire reused its stale fence',
	'stale lease fence sealed an observation set',
	'service role directly mutated supplier lease',
	'scrape run scope relabel was accepted',
	'terminal scrape run was reopened',
	'terminal scrape run was relabeled',
	'observation set sealed after run terminalization',
	'unknown observation set was inserted complete',
	'legacy observation set was inserted complete',
	'zero-result unknown set was accepted as complete',
	'zero-result legacy set was accepted as complete',
	'complete observation set was mutable',
	'zero-result supplier failure was accepted as complete',
	'enabled cohort cardinality was not derived from membership',
	'frozen cohort membership was mutable',
	'frozen cohort definition was mutable',
	'frozen cohort marker was cleared',
	'cohort membership mutated after frozen marker clear attempt',
	'retired cohort boundary was mutable'
]) {
	if (!behaviorTests.includes(scenario)) throw new Error(`Missing SQL scenario: ${scenario}`);
}

console.log('VALIDATION_PASS: non-activating market provenance migration contract');
