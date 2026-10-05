import { describe, expect, it } from 'vitest';
import { coffeeFilterName, coffeeRoastsHref, newRoastHref, readCoffeeFilter } from './coffee-links';

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

describe('the coffee a narrowed list is named for', () => {
	it('names the coffee from its roasts', () => {
		const roasts = [
			{ roast_id: 4531, coffee_id: 101, coffee_name: 'Ethiopia Wush Wush' },
			{ roast_id: 4530, coffee_id: 102, coffee_name: 'Colombia Sierra Nevada' }
		];

		expect(coffeeFilterName(roasts, 102)).toBe('Colombia Sierra Nevada');
		expect(coffeeFilterName(roasts, 999)).toBeNull();
		expect(coffeeFilterName([{ coffee_id: 7, coffee_name: '  ' }], 7)).toBeNull();
	});
});
