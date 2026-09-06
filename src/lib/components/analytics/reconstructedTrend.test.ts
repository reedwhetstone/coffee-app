import { describe, expect, it } from 'vitest';
import { reconstructTrend, type TrendObservation } from './reconstructedTrend';
const rows = (): TrendObservation[] =>
	Array.from({ length: 21 }, (_, i) => ({
		snapshot_date: `2026-07-${String(i + 1).padStart(2, '0')}`,
		origin: 'Indonesia',
		wholesale_only: false,
		price_median: 10 + i / 100,
		sample_size: 70,
		supplier_count: 8,
		synthetic: false
	}));
describe('supported median reconstruction', () => {
	it('replaces dropout spikes, not original evidence or well-supported market changes', () => {
		const data = rows();
		for (let i = 10; i < 15; i++)
			Object.assign(data[i], { sample_size: 16, supplier_count: 2, price_median: 16 });
		data[18].price_median = 20;
		const result = reconstructTrend(data);
		expect(result).toHaveLength(21);
		expect(result[12].value).toBeCloseTo(10.12);
		expect(result[12].kind).toBe('low_support_estimate');
		expect(result[12].original?.price_median).toBe(16);
		expect(result[18].value).toBe(20);
		expect(data[12].price_median).toBe(16);
	});
	it('fills a calendar gap without overshoot and identifies bracketing dates', () => {
		const data = rows().filter((_, i) => i < 7 || i > 16);
		const result = reconstructTrend(data);
		expect(result[12].value).toBeCloseTo(10.12);
		expect(result[12].kind).toBe('missing_date_estimate');
		expect(result[12].anchorDates).toEqual(['2026-07-07', '2026-07-18']);
		expect(result[12].original).toBeUndefined();
	});
	it('rejects unknown provenance and isolated synthetic points; does not extend the trailing edge', () => {
		const data = rows();
		data[0].synthetic = true;
		data[1].synthetic = undefined;
		data[20].sample_size = 2;
		const result = reconstructTrend(data);
		expect(result[0].date.toISOString()).toContain('2026-07-03');
		expect(result.at(-1)?.date.toISOString()).toContain('2026-07-20');
	});
	it('requires both support counts, preserves cohort isolation and rejects ambiguous duplicate anchors', () => {
		const data = rows();
		data[10].sample_size = 5;
		data[11].supplier_count = 1;
		data[12].supplier_count = undefined;
		data.push({ ...data[13], price_median: 99 });
		const result = reconstructTrend(data);
		for (let i = 10; i < 14; i++) expect(result[i].kind).not.toBe('recorded_anchor');
		expect(() => reconstructTrend([...data, { ...data[0], wholesale_only: true }])).toThrow(
			/cohort/
		);
	});
	it('ignores invalid dates and prices, and does not invent support for sparse series', () => {
		expect(reconstructTrend(rows().slice(0, 4))).toEqual([]);
		const data = rows();
		data[0].snapshot_date = '2026-02-31';
		data[1].price_median = NaN;
		data[2].price_median = -1;
		expect(reconstructTrend(data)[0].date.toISOString()).toContain('2026-07-04');
	});
});

const legacyRows = (): TrendObservation[] =>
	Array.from({ length: 6 }, (_, i) => ({
		snapshot_date: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString().slice(0, 10),
		origin: 'Indonesia',
		wholesale_only: false,
		price_median: i === 2 ? 90 : 9,
		sample_size: 30,
		supplier_count: 4,
		synthetic: true
	}));
describe('earlier modeled history', () => {
	it('bridges a robust legacy opening level without importing its spike or changing recorded history', () => {
		const legacy = legacyRows();
		const recorded = rows();
		const input = [...legacy, ...recorded];
		const before = JSON.stringify(input);
		const result = reconstructTrend(input);
		const historical = result.filter((p) => p.kind === 'historical_estimate');
		expect(historical[0].date.toISOString().slice(0, 10)).toBe('2026-01-01');
		expect(historical[0].value).toBe(9);
		expect(historical.every((p) => p.value >= 9 && p.value < 10)).toBe(true);
		expect(historical.every((p) => !p.original)).toBe(true);
		expect(historical[0].legacyBaseline?.dates).toHaveLength(6);
		expect(result.filter((p) => p.kind !== 'historical_estimate')).toEqual(
			reconstructTrend(recorded)
		);
		expect(JSON.stringify(input)).toBe(before);
		expect(new Set(result.map((p) => +p.date)).size).toBe(result.length);
	});
	it('requires explicit legacy evidence and a supported recorded endpoint, never invents history alone', () => {
		expect(reconstructTrend(legacyRows())).toEqual([]);
		expect(reconstructTrend([...legacyRows().slice(0, 4), ...rows()])).toEqual(
			reconstructTrend(rows())
		);
		expect(
			reconstructTrend([...legacyRows().map((r) => ({ ...r, synthetic: undefined })), ...rows()])
		).toEqual(reconstructTrend(rows()));
		const legacy = legacyRows().slice(0, 5);
		expect(reconstructTrend([...legacy, { ...legacy[0], price_median: 100 }, ...rows()])).toEqual(
			reconstructTrend(rows())
		);
	});
});
