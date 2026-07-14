import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(
	fileURLToPath(
		new URL('../supabase/migrations/20260714_shopify_durable_backoff.sql', import.meta.url)
	),
	'utf8'
).toLowerCase();
const behaviorTests = readFileSync(
	fileURLToPath(new URL('../supabase/tests/shopify_durable_backoff.sql', import.meta.url)),
	'utf8'
).toLowerCase();

for (const invariant of [
	'create table public.scraper_platform_backoff',
	"scope text primary key check (scope = 'shopify_fleet')",
	'create or replace function public.get_scraper_platform_backoff',
	'create or replace function public.record_scraper_platform_rate_limit',
	'create or replace function public.reset_scraper_platform_backoff',
	'for update',
	'v_new_strikes := v_state.consecutive_rate_limited_runs + 1',
	'v_effective_delay_seconds := greatest',
	'v_next_eligible_at := greatest',
	'p_expected_consecutive_rate_limited_runs',
	'172800',
	'security definer',
	'set search_path = public, pg_temp',
	'revoke all on table public.scraper_platform_backoff',
	'revoke all on function public._record_scraper_platform_rate_limit',
	'from public, anon, authenticated, service_role'
]) {
	if (!migration.includes(invariant)) throw new Error(`Missing migration invariant: ${invariant}`);
}

if (
	/grant\s+(all|insert|update|delete|truncate)[^;]*scraper_platform_backoff[^;]*service_role/s.test(
		migration
	)
) {
	throw new Error('Service role must not receive direct backoff-state mutation privileges');
}

for (const scenario of [
	'initial shopify fleet state was not eligible with zero strikes',
	'exponential delay progression was not preserved',
	'short retry-after reduced the local exponential delay',
	'retry-after above 48 hours was not honored',
	'later transition shortened an existing cooldown',
	'stale clean-run generation erased a newer rate limit',
	'clean-run reset did not clear strikes and eligibility',
	'anonymous or authenticated role can read backoff state',
	'service role can directly mutate backoff state',
	'non-service role can execute rate-limit transition',
	'service role can execute deterministic test seam',
	'service-role rate-limit rpc did not enforce first-strike delay'
]) {
	if (!behaviorTests.includes(scenario)) throw new Error(`Missing SQL scenario: ${scenario}`);
}

console.log('VALIDATION_PASS: durable Shopify backoff migration contract');
