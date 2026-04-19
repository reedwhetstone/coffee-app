import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// This repo does not have a lightweight Postgres migration harness in unit tests,
// so lock the shipped SQL contract directly until a DB-backed migration test exists.
function readSql(relativePath: string): string {
	return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const fullSchemaSql = readSql('supabase/migrations/001_full_schema.sql');
const explicitDefaultsMigrationSql = readSql(
	'supabase/migrations/20260412_explicit_entitlement_defaults.sql'
);

const signupDefaultsPattern =
	/INSERT INTO public\.user_roles \(id, email, name, role, user_role, api_plan, ppi_access\)\s+VALUES\s+\(\s*NEW\.id,\s*NEW\.email,\s*COALESCE\(NEW\.raw_user_meta_data->>'full_name', NEW\.raw_user_meta_data->>'name', ''\),\s*'viewer',\s*ARRAY\['viewer'\],\s*'viewer',\s*false\s*\)/s;

describe('explicit entitlement default SQL contract', () => {
	it('keeps the full-schema signup trigger on explicit viewer defaults', () => {
		expect(fullSchemaSql).toMatch(signupDefaultsPattern);
	});

	it('keeps the forward-migration signup trigger on explicit viewer defaults', () => {
		expect(explicitDefaultsMigrationSql).toMatch(signupDefaultsPattern);
	});

	it('normalizes malformed legacy api_plan values before adding the check constraint', () => {
		const normalizationSnippet = `UPDATE public.user_roles\nSET api_plan = CASE\n  WHEN api_plan IN ('viewer', 'member', 'enterprise') THEN api_plan\n  ELSE 'viewer'\nEND\nWHERE api_plan IS DISTINCT FROM CASE\n  WHEN api_plan IN ('viewer', 'member', 'enterprise') THEN api_plan\n  ELSE 'viewer'\nEND;`;
		const normalizationIndex = explicitDefaultsMigrationSql.indexOf(normalizationSnippet);
		const constraintIndex = explicitDefaultsMigrationSql.indexOf(
			'ADD CONSTRAINT user_roles_api_plan_check'
		);

		expect(normalizationIndex).toBeGreaterThan(-1);
		expect(constraintIndex).toBeGreaterThan(normalizationIndex);
	});

	it('backfills empty legacy user_role arrays from the authoritative role column', () => {
		expect(explicitDefaultsMigrationSql).toContain('SET user_role = CASE');
		expect(explicitDefaultsMigrationSql).toContain(
			"WHEN 'admin'::public.user_role THEN ARRAY['admin']::text[]"
		);
		expect(explicitDefaultsMigrationSql).toContain(
			"WHEN 'member'::public.user_role THEN ARRAY['member']::text[]"
		);
		expect(explicitDefaultsMigrationSql).toContain("ELSE ARRAY['viewer']::text[]");
	});
});
