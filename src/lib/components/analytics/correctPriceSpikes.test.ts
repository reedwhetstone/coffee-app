import { describe, expect, it } from 'vitest';
import { rows } from './correctPriceSpikes.fixture';
import { correctPriceSpikes } from './correctPriceSpikes';
describe('bounded incident correction', () => {
	it('preserves every point outside the two incidents, including early history and current endpoints', () => {
		const result = correctPriceSpikes(rows);
		expect(result).toHaveLength(rows.length);
		let changed = 0;
		result.forEach((r, i) => {
			if (r.price_estimated) {
				changed++;
				expect(
					(r.snapshot_date >= '2026-02-21' && r.snapshot_date <= '2026-03-14') ||
						(r.snapshot_date >= '2026-07-11' && r.snapshot_date <= '2026-07-15')
				).toBe(true);
				expect(r.price_median).toBeGreaterThan(9);
				expect(r.price_median).toBeLessThan(12);
			} else expect(r).toBe(rows[i]);
		});
		expect(changed).toBe(45);
	});
	it('does not repair wholesale, unknown provenance, or unaudited origins', () => {
		for (const change of [
			{ wholesale_only: true },
			{ synthetic: undefined },
			{ origin: 'Kenya' }
		]) {
			const input = rows.map((r) => ({ ...r, ...change }));
			expect(correctPriceSpikes(input)).toEqual(input);
		}
	});
	it('requires both unambiguous boundaries and never adds missing dates', () => {
		const input = rows.filter(
			(r) => r.snapshot_date !== '2026-02-14' && r.snapshot_date !== '2026-07-16'
		);
		expect(correctPriceSpikes(input)).toEqual(input);
		expect(correctPriceSpikes([...rows, ...rows])).toEqual([...rows, ...rows]);
	});
	it('is independent of input ordering and leaves source data immutable', () => {
		const before = structuredClone(rows);
		expect(correctPriceSpikes([...rows].reverse()).reverse()).toEqual(correctPriceSpikes(rows));
		expect(rows).toEqual(before);
	});
});
