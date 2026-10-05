import { describe, expect, it } from 'vitest';
import {
	coffeeFilterName,
	coffeeRoastsHref,
	filterBatchesByCoffee,
	newRoastHref,
	readCoffeeFilter
} from './coffee-links';

const params = (query: string) => new URLSearchParams(query);

describe('the roast list’s ?coffee= filter', () => {
	it('reads a portfolio inventory id', () => {
		expect(readCoffeeFilter(params('coffee=101'))).toBe(101);
		expect(readCoffeeFilter(params('roast=4531&coffee=101'))).toBe(101);
	});

	it.each(['', 'coffee=', 'coffee=0', 'coffee=-4', 'coffee=1.5', 'coffee=abc', 'coffee=1e3'])(
		'reads no filter from "%s"',
		(query) => {
			expect(readCoffeeFilter(params(query))).toBeNull();
		}
	);

	it('links to one coffee’s roasts and to the new-roast form with the coffee filled in', () => {
		expect(coffeeRoastsHref(101)).toBe('/roast?coffee=101');
		expect(newRoastHref(101, 'Ethiopia Guji & Co')).toBe(
			'/roast?modal=new&beanId=101&beanName=Ethiopia%20Guji%20%26%20Co'
		);
	});
});

describe('narrowing batches to one coffee', () => {
	const batchNames = [
		'Wednesday roast|||2026-10-01',
		'Guji drop test|||2026-09-27',
		'Kenya|||2026-09-20'
	];
	const groupedRoasts = {
		'Wednesday roast|||2026-10-01': [
			{ roast_id: 4531, coffee_id: 101, coffee_name: 'Ethiopia Wush Wush' },
			{ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' }
		],
		'Guji drop test|||2026-09-27': [
			{ roast_id: 4529, coffee_id: 101, coffee_name: 'Ethiopia Wush Wush' },
			{ roast_id: 4528, coffee_id: 101, coffee_name: 'Ethiopia Wush Wush' }
		],
		'Kenya|||2026-09-20': [{ roast_id: 4520, coffee_id: 103, coffee_name: 'Kenya Nyeri' }]
	};

	it('keeps only that coffee’s roasts and drops the batches without any', () => {
		const narrowed = filterBatchesByCoffee(batchNames, groupedRoasts, 101);

		expect(narrowed.batchNames).toEqual([
			'Wednesday roast|||2026-10-01',
			'Guji drop test|||2026-09-27'
		]);
		expect(narrowed.groupedRoasts['Wednesday roast|||2026-10-01'].map((r) => r.roast_id)).toEqual([
			4531
		]);
		expect(narrowed.groupedRoasts['Guji drop test|||2026-09-27']).toHaveLength(2);
		expect(narrowed.groupedRoasts).not.toHaveProperty('Kenya|||2026-09-20');
	});

	it('returns every batch when no coffee is chosen', () => {
		expect(filterBatchesByCoffee(batchNames, groupedRoasts, null)).toEqual({
			batchNames,
			groupedRoasts
		});
	});

	it('returns nothing for a coffee that has not been roasted', () => {
		expect(filterBatchesByCoffee(batchNames, groupedRoasts, 999)).toEqual({
			batchNames: [],
			groupedRoasts: {}
		});
	});

	it('names the coffee from its roasts', () => {
		const roasts = Object.values(groupedRoasts).flat();

		expect(coffeeFilterName(roasts, 102)).toBe('Colombia Sierra Nevada');
		expect(coffeeFilterName(roasts, 999)).toBeNull();
		expect(coffeeFilterName([{ coffee_id: 7, coffee_name: '  ' }], 7)).toBeNull();
	});
});
