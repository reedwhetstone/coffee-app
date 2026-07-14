import { describe, expect, it } from 'vitest';
import config from '../svelte.config.js';

describe('SvelteKit CSRF origin policy', () => {
	it('trusts only the owned apex alias used before the canonical www redirect', () => {
		expect(config.kit?.csrf).toEqual({
			trustedOrigins: ['https://purveyors.io']
		});
	});
});
