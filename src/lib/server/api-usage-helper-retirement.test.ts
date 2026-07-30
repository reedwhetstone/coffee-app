import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('local API usage helper retirement', () => {
	it('keeps direct API usage logging and rate-limit queries out of coffee-app', () => {
		const source = readFileSync(resolve('src/lib/server/apiAuth.ts'), 'utf8');

		expect(source).not.toContain("from('api_usage')");
		expect(source).not.toContain('validateAndLogApiRequest');
		expect(source).not.toContain('checkRateLimit');
	});
});
