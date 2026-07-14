import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SvelteKit CSRF origin policy', () => {
	it('keeps the strict default form-origin policy', () => {
		const configSource = readFileSync(resolve(process.cwd(), 'svelte.config.js'), 'utf8');

		expect(configSource).not.toMatch(/trustedOrigins\s*:/);
		expect(configSource).not.toMatch(/checkOrigin\s*:\s*false/);
	});
});
