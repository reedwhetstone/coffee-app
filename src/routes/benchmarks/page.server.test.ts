import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('legacy benchmarks page loader', () => {
	it('permanently redirects to Cherry Evals', () => {
		expect(() => load({} as never)).toThrow();
		try {
			load({} as never);
		} catch (error) {
			expect(error).toMatchObject({ status: 308, location: '/evals' });
		}
	});
});
