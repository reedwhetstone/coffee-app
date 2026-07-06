import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn()
}));

vi.mock('./parchmentClient', () => ({
	createParchmentServerClient: (...args: unknown[]) => mockCreateParchmentServerClient(...args),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

import { loadMarketIndexInsights } from './marketIndex';

function makeSignal(signalWindow: '7d' | '30d') {
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
		source: 'Example Supplier'
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

describe('loadMarketIndexInsights', () => {
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

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(insights.valueSignals?.map((signal) => signal.signalWindow)).toEqual(['7d', '30d']);
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual([
			'Dual Window Lot',
			'Dual Window Lot'
		]);
	});
});
