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
	'supplier_observation_sets',
	'coffee_price_observations',
	'market_index_cohorts',
	'market_index_cohort_sources',
	'market_publications',
	'market_publication_inputs',
	'market_publication_price_indexes'
];

for (const table of required) {
	if (!migration.includes(`create table public.${table}`))
		throw new Error(`Missing table ${table}`);
	if (
		!migration.includes(`alter table public.%i enable row level security`) &&
		!migration.includes(`alter table public.${table} enable row level security`)
	) {
		throw new Error(`Missing RLS contract for ${table}`);
	}
}

const invariants = [
	"where status = 'active'",
	'primary key (publication_id, source)',
	'unique (observation_set_id, catalog_id)',
	'guard_active_publication_inputs',
	'guard_active_publication_aggregates',
	'guard_market_publication_lifecycle',
	'guard_observation_artifact',
	'guard_market_cohort_immutability',
	'for update',
	"v_set_status <> 'complete'",
	'price_index_count',
	'publication manifest freshness counts must match publication source counts',
	'publication aggregate row count must be positive and match price_index_count',
	'complete known observation sets must be sealed from an open state',
	"completeness in ('known', 'unknown', 'legacy')",
	"freshness in ('fresh', 'carried')",
	'aggregation_tier in (1, 2, 3)',
	'revoke all on table public.%i from public, anon, authenticated',
	'grant all on table public.%i to service_role'
];
for (const invariant of invariants) {
	if (!migration.includes(invariant)) throw new Error(`Missing migration invariant: ${invariant}`);
}

if (/grant\s+select\s+on\s+(table\s+)?public\.market_/i.test(migration)) {
	throw new Error('Market publication tables must not receive public/authenticated SELECT grants');
}

for (const scenario of [
	'legacy observation set was accepted',
	'unknown-completeness complete set was accepted',
	'legacy-completeness complete set was accepted',
	'same-day observation was accepted as carried',
	'future observation was accepted',
	'caller-forged zero observation age was trusted',
	'caller-forged carried age was trusted',
	'direct active publication insert was accepted',
	'publication before cohort effective window was accepted',
	'publication after cohort effective window was accepted',
	'suppressed publication was activated',
	'publication without its represented source manifest was activated',
	'publication without aggregate rows was activated',
	'publication with mismatched freshness counts was activated',
	'direct complete known observation set was accepted',
	'empty observation set was completed',
	'referenced cohort membership was mutable',
	'referenced cohort definition was mutable',
	'artifact update into sealed publication was accepted',
	'artifact update out of sealed publication was accepted',
	'observation update out of complete set was accepted',
	'observation update into complete set was accepted',
	'rejected publication was not terminal',
	'rejected publication accepted artifact insert',
	'rejected publication accepted artifact update',
	'rejected publication accepted artifact delete',
	'invalid aggregate was accepted'
]) {
	if (!behaviorTests.includes(scenario))
		throw new Error(`Missing executable SQL scenario: ${scenario}`);
}

console.log('VALIDATION_PASS: market publication migration contract');
