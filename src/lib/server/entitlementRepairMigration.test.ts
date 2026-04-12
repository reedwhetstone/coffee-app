import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSql(relativePath: string): string {
	return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const repairMigrationSql = readSql(
	'supabase/migrations/20260412_repair_legacy_entitlement_backfill.sql'
);

describe('legacy entitlement repair SQL contract', () => {
	it('re-promotes legacy API pseudo-roles instead of leaving them at viewer', () => {
		expect(repairMigrationSql).toContain('SET api_plan = CASE');
		expect(repairMigrationSql).toContain("role = 'api_enterprise'::public.user_role");
		expect(repairMigrationSql).toContain("role = 'api_member'::public.user_role");
		expect(repairMigrationSql).toContain("ARRAY['api-enterprise', 'api_enterprise']::text[]");
		expect(repairMigrationSql).toContain(
			"ARRAY['api-member', 'api_member', 'api', 'developer', 'growth']::text[]"
		);
	});

	it('re-promotes legacy ppi-member rows to explicit ppi_access=true', () => {
		expect(repairMigrationSql).toContain('SET ppi_access = true');
		expect(repairMigrationSql).toContain("ARRAY['ppi-member']::text[]");
	});
});
