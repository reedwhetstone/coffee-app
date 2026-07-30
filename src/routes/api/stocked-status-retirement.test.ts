import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('stocked-status compatibility route retirement', () => {
	it('keeps the unused direct-Supabase helper and its documentation retired', () => {
		const routePath = resolve('src/routes/api/update-stocked-status/+server.ts');
		const docsSource = readFileSync(resolve('src/lib/docs/content.ts'), 'utf8');

		expect(existsSync(routePath)).toBe(false);
		expect(docsSource).not.toContain('/api/update-stocked-status');
	});
});
