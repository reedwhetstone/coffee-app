import { describe, expect, it } from 'vitest';
import { roastCoffeeOptions } from './roast-coffee-options';

describe('the roast list’s coffee choices', () => {
	it('lists the portfolio’s coffees by name', () => {
		expect(
			roastCoffeeOptions([
				{ id: 102, name: 'Colombia Sierra Nevada' },
				{ id: 101, coffee_catalog: { name: 'Ethiopia Yirgacheffe Wush Wush' } },
				{ id: 103, name: '  ', coffee_catalog: { name: ' Brazil Cerrado ' } }
			])
		).toEqual([
			{ id: 103, name: 'Brazil Cerrado' },
			{ id: 102, name: 'Colombia Sierra Nevada' },
			{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush' }
		]);
	});

	it('tells two purchases of one coffee apart by when each was bought', () => {
		expect(
			roastCoffeeOptions([
				{ id: 7, name: 'Ethiopia Guji', purchase_date: '2026-07-28' },
				{ id: 9, name: 'Ethiopia Guji', purchase_date: '2026-09-14' },
				{ id: 12, name: 'Ethiopia Guji', purchase_date: null },
				{ id: 8, name: 'Kenya Nyeri', purchase_date: '2026-07-28' }
			])
		).toEqual([
			{ id: 12, name: 'Ethiopia Guji · #12' },
			{ id: 7, name: 'Ethiopia Guji · purchased Jul 28, 2026' },
			{ id: 9, name: 'Ethiopia Guji · purchased Sep 14, 2026' },
			{ id: 8, name: 'Kenya Nyeri' }
		]);
	});

	it('names a coffee by its number when it has no name', () => {
		expect(roastCoffeeOptions([{ id: 55 }])).toEqual([{ id: 55, name: 'Coffee #55' }]);
	});
});
