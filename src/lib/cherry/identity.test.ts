import { describe, expect, it } from 'vitest';
import { CHERRY_AI_NAME, resolveCherryAgent } from './identity';

describe('Cherry AI product identity', () => {
	it('uses the full product-family name', () => {
		expect(CHERRY_AI_NAME).toBe('Cherry AI');
	});

	it.each([
		[false, false, null],
		[false, true, 'Cherry Roaster Agent'],
		[true, false, 'Cherry Green Agent'],
		[true, true, 'Cherry Synthesis Agent']
	] as const)(
		'resolves ppiAccess=%s and memberAccess=%s to %s',
		(ppiAccess, memberAccess, expectedName) => {
			expect(resolveCherryAgent({ ppiAccess, memberAccess })?.name ?? null).toBe(expectedName);
		}
	);
});
