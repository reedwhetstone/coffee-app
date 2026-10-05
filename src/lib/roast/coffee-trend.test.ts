import { describe, expect, it } from 'vitest';
import {
	NOT_RECORDED,
	newestFirst,
	newestRoastDifference,
	roastDayLabel,
	trendRow,
	trendSummaryLine
} from './coffee-trend';
import type { SummaryRoast } from './roast-summary';

function roast(overrides: Partial<SummaryRoast>): SummaryRoast {
	return {
		roast_id: 4531,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		oz_in: 16,
		oz_out: 13.7,
		weight_loss_percent: 14.4,
		temperature_unit: 'F',
		total_roast_time: 618,
		drop_time: 618,
		drop_temp: 402,
		development_percent: 19.4,
		...overrides
	};
}

describe('trend table row', () => {
	it('shows the recorded date, batch, weights, loss, time, drop, and development', () => {
		expect(trendRow(roast({}), 2026)).toEqual({
			roastId: 4531,
			date: 'Oct 1',
			batch: 'Wednesday roast',
			weights: '16 → 13.7 oz',
			loss: '14.4%',
			time: '10:18',
			drop: '402°F',
			development: '19.4%'
		});
	});

	it('shows the weight in alone, and no loss, when the weight out was not recorded', () => {
		const row = trendRow(roast({ oz_in: 12, oz_out: null, weight_loss_percent: null }), 2026);

		expect(row.weights).toBe('12 oz');
		expect(row.loss).toBe(NOT_RECORDED);
	});

	it('shows "—" for anything not recorded, never a zero', () => {
		const empty = trendRow(
			roast({
				batch_name: '  ',
				roast_date: null,
				oz_in: 0,
				oz_out: 0,
				weight_loss_percent: 0,
				total_roast_time: 0,
				drop_time: null,
				drop_temp: 0,
				development_percent: 0
			}),
			2026
		);

		expect(empty).toEqual({
			roastId: 4531,
			date: '—',
			batch: '—',
			weights: '—',
			loss: '—',
			time: '—',
			drop: '—',
			development: '—'
		});
		expect(Object.values(empty).join(' ')).not.toMatch(/\b0(\.0)?(%|°| oz|:00)?\b/);
	});

	it('works out the loss from the two weights when it was not stored', () => {
		expect(trendRow(roast({ oz_in: 10, oz_out: 8.5, weight_loss_percent: null }), 2026).loss).toBe(
			'15.0%'
		);
	});

	it('uses the drop time when no total roast time was stored, and the roast’s own unit', () => {
		const row = trendRow(
			roast({ total_roast_time: null, drop_time: 596, drop_temp: 205.4, temperature_unit: 'C' }),
			2026
		);

		expect(row.time).toBe('9:56');
		expect(row.drop).toBe('205°C');
	});

	it('adds the year to a roast from an earlier year', () => {
		expect(trendRow(roast({ roast_date: '2025-12-03T00:00:00Z' }), 2026).date).toBe('Dec 3, 2025');
		expect(roastDayLabel('2026-10-01', 2026)).toBe('Oct 1');
		expect(roastDayLabel(null, 2026)).toBeNull();
	});
});

describe('trend table order', () => {
	it('puts the newest roast first, and the higher roast number first within a day', () => {
		const ordered = newestFirst([
			roast({ roast_id: 4507, roast_date: '2026-09-17' }),
			roast({ roast_id: 4528, roast_date: '2026-09-27' }),
			roast({ roast_id: 4531, roast_date: '2026-10-01' }),
			roast({ roast_id: 4400, roast_date: null }),
			roast({ roast_id: 4529, roast_date: '2026-09-27' })
		]);

		expect(ordered.map((entry) => entry.roast_id)).toEqual([4531, 4529, 4528, 4507, 4400]);
	});
});

describe('summary line', () => {
	const five = [
		roast({ roast_id: 5, oz_in: 16, oz_out: 13.7, weight_loss_percent: 14.4 }),
		roast({ roast_id: 4, oz_in: 12, oz_out: null, weight_loss_percent: null }),
		roast({ roast_id: 3, oz_in: 12, oz_out: 10.4, weight_loss_percent: 13.3 }),
		roast({ roast_id: 2, oz_in: 16, oz_out: 13.8, weight_loss_percent: 13.7 }),
		roast({ roast_id: 1, oz_in: 8, oz_out: 6.9, weight_loss_percent: 13.7 })
	];

	it('counts the roasts, what was roasted, what is left, and the average loss', () => {
		expect(trendSummaryLine(five, 10)).toBe(
			'5 roasts · 64 oz roasted · 6.0 lb left · 13.8% average loss'
		);
	});

	it('averages only the roasts that recorded a loss', () => {
		expect(trendSummaryLine(five.slice(0, 2), 10)).toBe(
			'2 roasts · 28 oz roasted · 8.3 lb left · 14.4% average loss'
		);
	});

	it('leaves out what has nothing on record behind it', () => {
		expect(
			trendSummaryLine([roast({ oz_in: null, oz_out: null, weight_loss_percent: null })], null)
		).toBe('1 roast');
		// More was roasted than the purchase on record, so no "left" figure is claimed.
		expect(trendSummaryLine(five, 2)).toBe('5 roasts · 64 oz roasted · 13.8% average loss');
	});
});

describe('how the newest roast differs from the one before it', () => {
	const newest = roast({ roast_id: 4531, roast_date: '2026-10-01' });
	const before = (overrides: Partial<SummaryRoast>) =>
		roast({ roast_id: 4529, roast_date: '2026-09-27', ...overrides });

	it('says the change in time and drop temperature in words', () => {
		expect(
			newestRoastDifference(newest, before({ total_roast_time: 596, drop_temp: 398 }), 2026)
		).toBe('22 sec longer · 4°F hotter drop than Sep 27');
	});

	it('says shorter and cooler, and counts minutes', () => {
		expect(
			newestRoastDifference(newest, before({ total_roast_time: 700, drop_temp: 411 }), 2026)
		).toBe('1 min 22 sec shorter · 9°F cooler drop than Sep 27');
	});

	it('leaves out a reading either roast did not record', () => {
		expect(
			newestRoastDifference(newest, before({ total_roast_time: 596, drop_temp: null }), 2026)
		).toBe('22 sec longer than Sep 27');
		expect(
			newestRoastDifference(
				roast({ total_roast_time: null, drop_time: null }),
				before({ drop_temp: 398 }),
				2026
			)
		).toBe('4°F hotter drop than Sep 27');
	});

	it('says nothing when the two roasts have no reading in common', () => {
		expect(
			newestRoastDifference(
				newest,
				before({ total_roast_time: null, drop_time: null, drop_temp: null }),
				2026
			)
		).toBeNull();
	});

	it('does not compare drop temperatures recorded in different units', () => {
		expect(
			newestRoastDifference(
				newest,
				before({ total_roast_time: 596, drop_temp: 204, temperature_unit: 'C' }),
				2026
			)
		).toBe('22 sec longer than Sep 27');
	});

	it('says when a reading is the same', () => {
		expect(
			newestRoastDifference(newest, before({ total_roast_time: 618, drop_temp: 398 }), 2026)
		).toBe('Same time · 4°F hotter drop than Sep 27');
		expect(newestRoastDifference(newest, before({}), 2026)).toBe(
			'Same time and same drop temperature as Sep 27'
		);
	});

	it('names the earlier roast by number when both were roasted on one day', () => {
		expect(
			newestRoastDifference(
				roast({ roast_id: 4529, roast_date: '2026-09-27', total_roast_time: 596 }),
				roast({ roast_id: 4528, roast_date: '2026-09-27', total_roast_time: 640, drop_temp: 407 }),
				2026
			)
		).toBe('44 sec shorter · 5°F cooler drop than roast #4528');
	});
});
