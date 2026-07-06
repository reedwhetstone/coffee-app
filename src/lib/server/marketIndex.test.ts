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
					data: ids.map((id) => ({ id, name }))
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

	it('marks public signal summaries as retail-scoped proof data', async () => {
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
		expect(insights.signalsSummary).toEqual({
			total: 5,
			byType: { price_drop: 2, below_market: 3, value_quality: 0 },
			asOf: '2026-07-06',
			market: 'retail'
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
						data: [sevenDay, thirtyDay],
						meta: { asOf: '2026-07-06' },
						pagination: { total: 2 }
					}
				})
				.mockResolvedValueOnce({ data: { data: [sevenDay], meta: { asOf: '2026-07-06' } } })
				.mockResolvedValueOnce({ data: { data: [], meta: { asOf: '2026-07-06' } } }),
			metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
		};
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});
		mockAdminNameLookup('Dual Window Lot');

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(insights.valueSignals?.map((signal) => signal.signalWindow)).toEqual(['7d', '30d']);
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual([
			'Dual Window Lot',
			'Dual Window Lot'
		]);
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
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Gated Wholesale Lot']);
	});

	it('keeps Parchment response names without a fallback catalog lookup', async () => {
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
		mockCreateParchmentServerClient.mockResolvedValue({
			market,
			priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
		});

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(mockCreateAdminClient).not.toHaveBeenCalled();
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Parchment Named Lot']);
	});
});
