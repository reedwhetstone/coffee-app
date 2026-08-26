import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('CoffeeBench v0 page loader', () => {
	it('permanently redirects the preview URL to the V1 findings', () => {
		expect(() => load({} as never)).toThrow();
		try {
			load({} as never);
		} catch (error) {
			expect(error).toMatchObject({ status: 308, location: '/benchmarks/coffeebench-v1' });
		}
	});
});
