import { describe, it, expect } from 'vitest';
import { buildOriginPriceMap, getLotPriceContext } from './priceContext';

const makeRow = (
	country: string,
	price: number,
	wholesale = false,
	source = 'Supplier A'
) => ({
	country,
	price_per_lb: price,
	cost_lb: null,
	wholesale,
	source
});

describe('buildOriginPriceMap', () => {
	it('returns empty map when no rows are given', () => {
		expect(buildOriginPriceMap([]).size).toBe(0);
	});

	it('excludes origins with fewer than 3 priced lots', () => {
		const rows = [makeRow('Rwanda', 5.0), makeRow('Rwanda', 6.0)];
		expect(buildOriginPriceMap(rows).size).toBe(0);
	});

	it('computes correct median and percentiles for a simple dataset', () => {
		const rows = [
			makeRow('Ethiopia', 4.0),
			makeRow('Ethiopia', 5.0),
			makeRow('Ethiopia', 6.0),
			makeRow('Ethiopia', 7.0),
			makeRow('Ethiopia', 8.0)
		];
		const map = buildOriginPriceMap(rows);
		const stats = map.get('Ethiopia')!;
		expect(stats).toBeDefined();
		expect(stats.median).toBe(6.0);
		expect(stats.min).toBe(4.0);
		expect(stats.max).toBe(8.0);
		expect(stats.sample_size).toBe(5);
	});

	it('counts distinct suppliers correctly', () => {
		const rows = [
			{ country: 'Kenya', price_per_lb: 5.0, cost_lb: null, wholesale: false, source: 'Sup A' },
			{ country: 'Kenya', price_per_lb: 6.0, cost_lb: null, wholesale: false, source: 'Sup B' },
			{ country: 'Kenya', price_per_lb: 7.0, cost_lb: null, wholesale: false, source: 'Sup A' }
		];
		const map = buildOriginPriceMap(rows);
		expect(map.get('Kenya')!.supplier_count).toBe(2);
	});

	it('excludes wholesale rows when scope is retail', () => {
		const rows = [
			makeRow('Colombia', 5.0, false),
			makeRow('Colombia', 6.0, false),
			makeRow('Colombia', 7.0, false),
			makeRow('Colombia', 3.0, true), // wholesale — should be excluded
			makeRow('Colombia', 3.5, true)
		];
		const map = buildOriginPriceMap(rows, 'retail');
		const stats = map.get('Colombia')!;
		expect(stats.sample_size).toBe(3);
		expect(stats.min).toBeCloseTo(5.0);
	});

	it('excludes retail rows when scope is wholesale', () => {
		const rows = [
			makeRow('Colombia', 5.0, false),
			makeRow('Colombia', 5.0, false),
			makeRow('Colombia', 5.0, false),
			makeRow('Colombia', 3.0, true),
			makeRow('Colombia', 4.0, true),
			makeRow('Colombia', 5.0, true)
		];
		const map = buildOriginPriceMap(rows, 'wholesale');
		const stats = map.get('Colombia')!;
		expect(stats.sample_size).toBe(3);
		expect(stats.max).toBeCloseTo(5.0);
	});

	it('falls back to cost_lb when price_per_lb is null', () => {
		const rows = [
			{ country: 'Peru', price_per_lb: null, cost_lb: 4.5, wholesale: false, source: 'A' },
			{ country: 'Peru', price_per_lb: null, cost_lb: 5.0, wholesale: false, source: 'B' },
			{ country: 'Peru', price_per_lb: null, cost_lb: 5.5, wholesale: false, source: 'C' }
		];
		const map = buildOriginPriceMap(rows);
		expect(map.get('Peru')!.median).toBeCloseTo(5.0);
	});

	it('skips rows with no country or no price', () => {
		const rows = [
			{ country: null, price_per_lb: 5.0, cost_lb: null, wholesale: false, source: 'A' },
			{ country: 'Ethiopia', price_per_lb: null, cost_lb: null, wholesale: false, source: 'B' },
			makeRow('Ethiopia', 5.0),
			makeRow('Ethiopia', 6.0),
			makeRow('Ethiopia', 7.0)
		];
		const map = buildOriginPriceMap(rows);
		expect(map.get('Ethiopia')!.sample_size).toBe(3);
	});
});

describe('getLotPriceContext', () => {
	const stats = {
		origin: 'Ethiopia',
		median: 5.0,
		q1: 4.0,
		q3: 6.5,
		min: 3.0,
		max: 10.0,
		sample_size: 20,
		supplier_count: 5
	};

	it('returns null when price is null', () => {
		expect(getLotPriceContext(null, stats)).toBeNull();
	});

	it('returns null when stats are undefined', () => {
		expect(getLotPriceContext(5.0, undefined)).toBeNull();
	});

	it('returns null when median is zero', () => {
		expect(getLotPriceContext(5.0, { ...stats, median: 0 })).toBeNull();
	});

	it('classifies a lot 20% below median as well_below', () => {
		const ctx = getLotPriceContext(4.0, stats)!; // 4.0 is 20% below 5.0
		expect(ctx.tier).toBe('well_below');
		expect(ctx.label).toMatch(/below median/);
		expect(ctx.percent_diff).toBeLessThan(0);
	});

	it('classifies a lot 10% below median as below', () => {
		const ctx = getLotPriceContext(4.5, stats)!; // 4.5 is 10% below 5.0
		expect(ctx.tier).toBe('below');
		expect(ctx.label).toMatch(/below median/);
	});

	it('classifies a lot within 5% of median as at', () => {
		const ctx = getLotPriceContext(5.1, stats)!; // 2% above — near median
		expect(ctx.tier).toBe('at');
		expect(ctx.label).toBe('Near median');
	});

	it('classifies a lot exactly at median as at', () => {
		const ctx = getLotPriceContext(5.0, stats)!;
		expect(ctx.tier).toBe('at');
	});

	it('classifies a lot 10% above median as above', () => {
		const ctx = getLotPriceContext(5.5, stats)!; // 10% above 5.0
		expect(ctx.tier).toBe('above');
		expect(ctx.label).toMatch(/above median/);
	});

	it('classifies a lot 30% above median as well_above', () => {
		const ctx = getLotPriceContext(6.5, stats)!; // 30% above 5.0
		expect(ctx.tier).toBe('well_above');
		expect(ctx.label).toMatch(/above median/);
	});

	it('rounds percent_diff to nearest integer', () => {
		const ctx = getLotPriceContext(4.37, stats)!; // ~12.6% below
		expect(Number.isInteger(ctx.percent_diff)).toBe(true);
	});
});
