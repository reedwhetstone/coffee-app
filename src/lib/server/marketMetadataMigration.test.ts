import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
	resolve(process.cwd(), 'supabase/migrations/20260707_01_metadata_index_purveyor_score.sql'),
	'utf8'
);

describe('Market Metadata Purveyor Score migration', () => {
	it('removes the supplier-score dimension and replaces it with Purveyor Score dimensions', () => {
		expect(migrationSql).toContain("WHERE dimension = 'score'");
		expect(migrationSql).toContain("'purveyor_score'");
		expect(migrationSql).toContain("'purveyor_score_confidence'");
		expect(migrationSql).toContain("'purveyor_score_tier'");
		expect(migrationSql).not.toContain("dimension IN ('process','disclosure','score')");
	});

	it('does not use supplier score_value inside the replacement metadata RPC', () => {
		const functionBody = migrationSql.slice(migrationSql.indexOf('CREATE OR REPLACE FUNCTION'));
		expect(functionBody).toContain('cc.purveyor_score::numeric');
		expect(functionBody).toContain('cc.purveyor_score_confidence::numeric');
		expect(functionBody).not.toContain('cc.score_value');
		expect(functionBody).toContain('Supplier score_value is intentionally not used');
	});

	it('preserves service-role-only execution for the security definer RPC', () => {
		expect(migrationSql).toContain(
			'REVOKE EXECUTE ON FUNCTION public.compute_metadata_index(date) FROM PUBLIC, anon, authenticated'
		);
		expect(migrationSql).toContain(
			'GRANT EXECUTE ON FUNCTION public.compute_metadata_index(date) TO service_role'
		);
	});

	it('backfills existing snapshot periods after replacing the RPC', () => {
		expect(migrationSql).toContain('FOR v_period_date IN');
		expect(migrationSql).toContain('date_trunc(');
		expect(migrationSql).toContain('PERFORM 1 FROM public.compute_metadata_index(v_period_date)');
	});
});
