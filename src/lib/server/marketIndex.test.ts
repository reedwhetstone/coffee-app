import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient, mockCreateAdminClient } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn(),
	mockCreateAdminClient: vi.fn()
}));

vi.mock('./parchmentClient', () => ({
	createParchmentServerClient: (...args: unknown[]) => mockCreateParchmentServerClient(...args),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args)
}));

import { loadMarketIndexInsights } from './marketIndex';

function makeSignal(signalWindow: '7d' | '30d', overrides: Record<string, unknown> = {}) {
	return {
		catalogId: 101,
		catalogUrl: 'https://purveyors.io/catalog/101',
		currentPriceLb: 6.75,
		evidence: {
			discount_vs_median_pct: null,
			drop_vs_own_median_pct: -8,
			own_trailing_median: 7.34,
			own_trailing_window: signalWindow,
			price_percentile_in_segment: null,
			segment: { origin: 'Colombia', process: 'Washed' },
			segment_median: null,
			value_z_score: null
		},
		market: 'retail',
		origin: 'Colombia',
		process: 'Washed',
		rankScore: signalWindow === '7d' ? 20 : 10,
		scoreValue: null,
		signalType: 'price_drop',
		signalWindow,
		source: 'Example Supplier',
		...overrides
	};
}

function makeEvent(): RequestEvent {
	return {
		locals: {
			supabase: {
				from: vi.fn(() => ({
					select: vi.fn(() => ({
						in: vi.fn(async () => ({ data: [{ id: 101, name: 'Dual Window Lot' }] }))
					}))
				}))
			}
		}
	} as unknown as RequestEvent;
}

function mockAdminNameLookup(name: string) {
	const adminClient = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				in: vi.fn(async (_column: string, ids: number[]) => ({
					data: ids.map((id) => ({ id, name, source: 'Example Supplier', wholesale: false }))
				}))
			}))
		}))
	};
	mockCreateAdminClient.mockReturnValue(adminClient);
	return adminClient;
}

describe('loadMarketIndexInsights', () => {
	beforeEach(() => {
		mockCreateParchmentServerClient.mockReset();
		mockCreateAdminClient.mockReset();
	});

	it('labels the public unfiltered signal summary as all-market', async () => {
		const market = {
			signals: vi.fn().mockResolvedValue({
				data: {
					meta: {
						asOf: '2026-07-06',
						summary: {
							total: 5,
							byType: { price_drop: 2, below_market: 3, value_quality: 0 }
						}
					}
				}
			}),
			metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
		};
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: false });

		expect(market.signals).toHaveBeenCalledWith({ summary: 'true' });
		// The public `summary=true` slice is unfiltered (retail + wholesale) and
		// cannot be market-scoped without entitlement, so it is never labeled retail.
		expect(insights.signalsSummary).toEqual({
			total: 5,
			byType: { price_drop: 2, below_market: 3, value_quality: 0 },
			asOf: '2026-07-06',
			market: 'all'
		});
	});

	it('preserves distinct signal windows while deduping exact scope backfills', async () => {
		const sevenDay = makeSignal('7d');
		const thirtyDay = makeSignal('30d');
		const market = {
			signals: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						data: [thirtyDay],
						meta: { asOf: '2026-07-06' },
						pagination: { total: 1 }
					}
				})
				.mockResolvedValueOnce({ data: { data: [sevenDay], meta: { asOf: '2026-07-06' } } })
				.mockResolvedValueOnce({ data: { data: [], meta: { asOf: '2026-07-06' } } })
				.mockResolvedValueOnce({ data: { data: [], meta: { asOf: '2026-07-06' } } }),
			metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
		};
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});
		mockAdminNameLookup('Dual Window Lot');

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		// Per-market pages only: the 'all' scope is reconstructed from the merged
		// per-market pages after the rank re-sort, so no 'all' fetches are made.
		expect(market.signals).toHaveBeenCalledTimes(4);
		expect(market.signals).toHaveBeenNthCalledWith(1, {
			market: 'retail',
			type: ['price_drop', 'below_market'],
			window: '30d',
			limit: 6
		});
		expect(market.signals).toHaveBeenNthCalledWith(2, {
			market: 'retail',
			type: ['price_drop'],
			window: '7d',
			limit: 6
		});
		expect(market.signals).toHaveBeenNthCalledWith(3, {
			market: 'wholesale',
			type: ['price_drop', 'below_market'],
			window: '30d',
			limit: 6
		});
		expect(market.signals).toHaveBeenNthCalledWith(4, {
			market: 'wholesale',
			type: ['price_drop'],
			window: '7d',
			limit: 6
		});
		expect(insights.valueSignals?.map((signal) => signal.signalWindow)).toEqual(['7d', '30d']);
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual([
			'Dual Window Lot',
			'Dual Window Lot'
		]);
		expect(market.metadataIndex).toHaveBeenCalledWith({ dimension: 'process', grain: 'month' });
		expect(market.metadataIndex).toHaveBeenCalledWith({ dimension: 'disclosure', grain: 'month' });
		expect(market.metadataIndex).toHaveBeenCalledWith({
			dimension: 'purveyor_score',
			grain: 'month'
		});
		expect(market.metadataIndex).toHaveBeenCalledWith({
			dimension: 'purveyor_score_confidence',
			grain: 'month'
		});
		expect(market.metadataIndex).toHaveBeenCalledWith({
			dimension: 'purveyor_score_tier',
			grain: 'month'
		});
	});

	it('uses an authorized server lookup when gated signal names are hidden by request RLS', async () => {
		const wholesaleSignal = makeSignal('7d', {
			catalogId: 202,
			market: 'wholesale',
			name: null
		});
		const market = {
			signals: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						data: [wholesaleSignal],
						meta: { asOf: '2026-07-06' },
						pagination: { total: 1 }
					}
				})
				.mockResolvedValueOnce({ data: { data: [], meta: { asOf: '2026-07-06' } } })
				.mockResolvedValueOnce({ data: { data: [wholesaleSignal], meta: { asOf: '2026-07-06' } } }),
			metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
		};
		const adminClient = mockAdminNameLookup('Gated Wholesale Lot');
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(adminClient.from).toHaveBeenCalledWith('coffee_catalog');
		const selectColumns = adminClient.from.mock.results[0].value.select.mock.calls[0][0] as string;
		expect(selectColumns).not.toBe('*');
		expect(selectColumns).toContain('processing_evidence_available');
		expect(selectColumns).not.toMatch(/(^|,\s*)processing_evidence(,|$)/);
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Gated Wholesale Lot']);
		expect(insights.valueSignals?.[0]?.coffee).toMatchObject({
			id: 202,
			name: 'Gated Wholesale Lot',
			source: 'Example Supplier'
		});
	});

	it('keeps Parchment response names while still attaching a sanitized catalog drawer row', async () => {
		const namedSignal = makeSignal('7d', {
			catalogId: 303,
			name: 'Parchment Named Lot'
		});
		const market = {
			signals: vi
				.fn()
				.mockResolvedValueOnce({
					data: {
						data: [namedSignal],
						meta: { asOf: '2026-07-06' },
						pagination: { total: 1 }
					}
				})
				.mockResolvedValueOnce({ data: { data: [namedSignal], meta: { asOf: '2026-07-06' } } })
				.mockResolvedValueOnce({ data: { data: [], meta: { asOf: '2026-07-06' } } }),
			metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
		};
		mockAdminNameLookup('Catalog Fallback Name');
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(mockCreateAdminClient).toHaveBeenCalled();
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Parchment Named Lot']);
		expect(insights.valueSignals?.[0]?.coffee).toMatchObject({
			id: 303,
			name: 'Catalog Fallback Name'
		});
	});
});
