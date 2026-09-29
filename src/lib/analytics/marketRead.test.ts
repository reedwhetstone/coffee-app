import { describe, expect, it } from 'vitest';
import {
	buildMarketReadHeadline,
	formatSignedMoneyPerLb,
	formatSignedPct,
	missingMonths,
	rankOriginMovers,
	type MarketReadInput,
	type OriginPricePoint
} from './marketRead';

describe('formatting', () => {
	it('renders flat moves as "Flat" without a stray unit', () => {
		expect(formatSignedPct(0)).toBe('Flat');
		expect(formatSignedPct(0.04)).toBe('Flat');
		expect(formatSignedMoneyPerLb(0)).toBe('Flat');
	});

	it('signs and units non-flat moves', () => {
		expect(formatSignedPct(1.26)).toBe('+1.3%');
		expect(formatSignedPct(-4.91)).toBe('−4.9%');
		expect(formatSignedMoneyPerLb(-3.49)).toBe('−$3.49/lb');
		expect(formatSignedMoneyPerLb(null)).toBe('N/A');
	});
});

describe('buildMarketReadHeadline', () => {
	const base: MarketReadInput = {
		windowLabel: '7-day',
		scopeLabel: 'retail',
		movementAvailable: true,
		arrivals: 64,
		delistings: 55,
		stockedListings: 910,
		priceMove: { latestMovePct: 0, classification: 'quiet', weeksSinceLargerMove: 1 }
	};

	it('does not call a ~1% net supply change an expansion', () => {
		expect(buildMarketReadHeadline(base)).toBe(
			'No significant retail move in the 7-day window: prices stayed within normal variance, and arrivals and delistings roughly offset (64 in, 55 out).'
		);
	});

	it('headlines supply when the net change is a meaningful share of listings', () => {
		expect(buildMarketReadHeadline({ ...base, arrivals: 90, delistings: 40 })).toBe(
			'Retail supply grew by a net 50 lots in the 7-day window (5.5% of listings).'
		);
		expect(buildMarketReadHeadline({ ...base, arrivals: 10, delistings: 50 })).toMatch(
			/^Retail supply tightened by a net 40 lots/
		);
	});

	it('headlines price only when the move is classified notable or exceptional', () => {
		expect(
			buildMarketReadHeadline({
				...base,
				priceMove: { latestMovePct: -4.9, classification: 'notable', weeksSinceLargerMove: 12 }
			})
		).toBe('Retail prices fell −4.9% over the 7-day window, the largest move in 12 weeks.');
		expect(
			buildMarketReadHeadline({
				...base,
				priceMove: { latestMovePct: 2.1, classification: 'normal', weeksSinceLargerMove: 2 }
			})
		).toMatch(/^No significant retail move/);
	});

	it('makes no supply call when movement data is unavailable', () => {
		expect(buildMarketReadHeadline({ ...base, movementAvailable: false })).toMatch(
			/movement data is unavailable/
		);
	});

	it('omits the price clause before significance stats load', () => {
		expect(buildMarketReadHeadline({ ...base, priceMove: null })).toBe(
			'No significant retail move in the 7-day window: arrivals and delistings roughly offset (64 in, 55 out).'
		);
	});
});

describe('rankOriginMovers', () => {
	const row = (
		origin: string,
		date: string,
		median: number,
		suppliers: number,
		avg = median
	): OriginPricePoint => ({
		origin,
		snapshot_date: date,
		price_median: median,
		price_avg: avg,
		supplier_count: suppliers,
		sample_size: 10
	});

	it('excludes thin origins and ranks by percent, not dollars', () => {
		const rows = [
			row('Hawaii', '2026-09-21', 46.94, 3),
			row('Hawaii', '2026-09-27', 43.45, 3),
			row('Saint Helena', '2026-09-21', 201.36, 1),
			row('Saint Helena', '2026-09-27', 199.09, 1),
			row('Uganda', '2026-09-21', 9.5, 7),
			row('Uganda', '2026-09-27', 10.05, 7),
			row('Brazil', '2026-09-21', 10.0, 20),
			row('Brazil', '2026-09-27', 10.1, 20)
		];
		const movers = rankOriginMovers(rows, '2026-09-27', '2026-09-21');
		expect(movers.map((m) => m.origin)).toEqual(['Hawaii', 'Uganda']);
		expect(movers[0].deltaPct).toBeCloseTo(-7.43, 1);
	});

	it('uses medians so a premium tail does not move an origin', () => {
		const rows = [
			row('Costa Rica', '2026-09-21', 10.0, 23, 15.0),
			row('Costa Rica', '2026-09-27', 10.05, 23, 18.86)
		];
		expect(rankOriginMovers(rows, '2026-09-27', '2026-09-21')).toEqual([]);
	});
});

describe('missingMonths', () => {
	it('finds interior gaps only', () => {
		expect(
			missingMonths(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-09'])
		).toEqual(['2026-08']);
		expect(missingMonths(['2025-11', '2026-02'])).toEqual(['2025-12', '2026-01']);
		expect(missingMonths(['2026-09'])).toEqual([]);
	});
});
