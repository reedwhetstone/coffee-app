import { describe, expect, it } from 'vitest';
import {
	cohortSeriesLabel,
	dailySegments,
	inspectionDate,
	observationOnDate,
	trendDomain
} from './originTrend';

const point = (day: string, value = 10) => ({ date: new Date(day), value });

describe('published origin trend evidence', () => {
	it('breaks the July–September publication gap instead of interpolating it', () => {
		const points = [
			point('2026-07-20'),
			point('2026-07-21'),
			point('2026-09-01'),
			point('2026-09-02')
		];
		expect(dailySegments(points).map((segment) => segment.length)).toEqual([2, 2]);
		expect(observationOnDate(points, new Date('2026-08-15'))).toBeUndefined();
		expect(observationOnDate(points, new Date('2026-09-01'))).toBe(points[2]);
	});

	it('snaps the inspection date in UTC without substituting a nearby observation', () => {
		const date = inspectionDate(new Date('2026-08-31T23:00:00-06:00'));
		expect(date.toISOString()).toBe('2026-09-01T00:00:00.000Z');
		expect(observationOnDate([point('2026-08-31')], date)).toBeUndefined();
	});

	it('does not join estimated and observed history or silently change statistics', () => {
		const points = [
			{ ...point('2026-03-20'), synthetic: true, statistic: 'Median' },
			{ ...point('2026-03-21'), synthetic: false, statistic: 'Median' },
			{ ...point('2026-03-22'), synthetic: false, statistic: 'Average' }
		];
		expect(dailySegments(points).map((segment) => segment.length)).toEqual([1, 1, 1]);
	});

	it('keeps suspicious extremes visible even when less than five percent of the series', () => {
		const domain = trendDomain([...Array(100).fill(10), 52]);
		expect(domain[1]).toBeGreaterThan(52);
		expect(domain[0]).toBeLessThan(10);
		const spread = trendDomain([-70, ...Array(100).fill(10), 150], true);
		expect(spread[0]).toBeLessThan(-70);
		expect(spread[1]).toBeGreaterThan(150);
		expect(trendDomain([10, 10])).toEqual([9.75, 10.25]);
	});

	it('keeps retail and wholesale medians distinct rather than averaging medians', () => {
		expect(cohortSeriesLabel('Colombia', false, true)).toBe('Colombia · retail');
		expect(cohortSeriesLabel('Colombia', true, true)).toBe('Colombia · wholesale');
		expect(cohortSeriesLabel('Colombia', false, false)).toBe('Colombia');
	});
});
