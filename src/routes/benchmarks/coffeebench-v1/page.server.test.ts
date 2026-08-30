import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('legacy CoffeeBench V1 page loader', () => {
	it('permanently redirects to the Cherry Evals findings', () => {
		expect(() => load({} as never)).toThrow();
		try {
			load({} as never);
		} catch (error) {
			expect(error).toMatchObject({ status: 308, location: '/evals/coffeebench-v1' });
		}
	});
});
