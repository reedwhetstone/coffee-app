import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSql(relativePath: string): string {
	return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const migrationSql = readSql('supabase/migrations/20260706_supplier_price_ranges.sql');

describe('supplier price ranges migration SQL contract', () => {
	it('normalizes blank supplier sources before grouping price aggregates', () => {
		const normalizeIndex = migrationSql.indexOf("nullif(btrim(source), '') as source");
		expect(normalizeIndex).toBeGreaterThan(-1);

		for (const market of ["'retail'::text", "'wholesale'::text", "'all'::text"]) {
			const marketIndex = migrationSql.indexOf(market);
			const groupIndex = migrationSql.indexOf('group by source', marketIndex);
			expect(groupIndex).toBeGreaterThan(normalizeIndex);
		}
	});

	it('includes stocked priced lots even when origin metadata is missing', () => {
		expect(migrationSql).toContain('where stocked = true');
		expect(migrationSql).toContain('and price_per_lb is not null');
		expect(migrationSql).toContain('and price_per_lb > 0');
		expect(migrationSql).not.toContain('country is not null');
	});

	it('keeps the RPC restricted to the service role', () => {
		expect(migrationSql).toContain('security definer');
		expect(migrationSql).toContain('set search_path = public');
		expect(migrationSql).toContain(
			'revoke execute on function public.get_supplier_price_ranges() from anon'
		);
		expect(migrationSql).toContain(
			'revoke execute on function public.get_supplier_price_ranges() from authenticated'
		);
		expect(migrationSql).toContain(
			'grant execute on function public.get_supplier_price_ranges() to service_role'
		);
	});
});
