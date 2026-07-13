import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(
	fileURLToPath(
		new URL('../supabase/migrations/20260713_market_publication_foundation.sql', import.meta.url)
	),
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
	'guard_sealed_market_publication',
	'guard_complete_observation_set',
	"completeness in ('known', 'unknown', 'legacy')",
	"freshness in ('fresh', 'carried', 'legacy')",
	'revoke all on table public.%i from public, anon, authenticated',
	'grant all on table public.%i to service_role'
];
for (const invariant of invariants) {
	if (!migration.includes(invariant)) throw new Error(`Missing migration invariant: ${invariant}`);
}

if (/grant\s+select\s+on\s+(table\s+)?public\.market_/i.test(migration)) {
	throw new Error('Market publication tables must not receive public/authenticated SELECT grants');
}

console.log('VALIDATION_PASS: market publication migration contract');
