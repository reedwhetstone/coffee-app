import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SvelteKit CSRF origin policy', () => {
	it('trusts only the owned apex alias used before the canonical www redirect', () => {
		const configSource = readFileSync(resolve(process.cwd(), 'svelte.config.js'), 'utf8');
		const trustedOriginLists = [...configSource.matchAll(/trustedOrigins\s*:\s*\[([^\]]*)\]/g)];

		expect(trustedOriginLists).toHaveLength(1);
		expect(trustedOriginLists[0]?.[1]?.replace(/\s/g, '')).toBe("'https://purveyors.io'");
	});
});
