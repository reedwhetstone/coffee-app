import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn()
}));

vi.mock('./parchmentClient', () => ({
	createParchmentServerClient: (...args: unknown[]) => mockCreateParchmentServerClient(...args),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

import { loadMarketIndexInsights } from './marketIndex';

function makeSignal(signalWindow: '7d' | '30d', overrides: Record<string, unknown> = {}) {
	return {
		catalogId: 101,
		catalogUrl: 'https://purveyors.io/catalog/101',
		name: 'Dual Window Lot',
		coffee: { id: 101, name: 'Dual Window Lot', source: 'Example Supplier' },
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
		rankScoreInput: 'drop_vs_own_median_pct',
		rankSignalMagnitude: 8,
		scoreValue: null,
		signalType: 'price_drop',
		signalWindow,
		source: 'Example Supplier',
		...overrides
	};
}

function makeEvent(): RequestEvent {
	return { locals: {} } as unknown as RequestEvent;
}

function configureClient(signalResults: unknown[]) {
	const signals = vi.fn();
	for (const result of signalResults) signals.mockResolvedValueOnce(result);
	const market = {
		signals,
		metadataIndex: vi.fn().mockResolvedValue({ data: { data: [] } })
	};
	mockCreateParchmentServerClient.mockResolvedValue({
		market,
		priceIndex: { stats: vi.fn().mockResolvedValue({ data: { data: [] } }) }
	});
	return market;
}

function signalPage(items: unknown[]) {
	return {
		data: {
			data: items,
			meta: { asOf: '2026-07-06' },
			pagination: { total: items.length }
		}
	};
}

describe('loadMarketIndexInsights', () => {
	beforeEach(() => {
		mockCreateParchmentServerClient.mockReset();
	});

	it('labels the public unfiltered signal summary as all-market', async () => {
		const market = configureClient([
			{
				data: {
					meta: {
						asOf: '2026-07-06',
						summary: {
							total: 5,
							byType: { price_drop: 2, below_market: 3, value_quality: 0 }
						}
					}
				}
			}
		]);

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: false });

		expect(market.signals).toHaveBeenCalledWith({ summary: 'true' });
		expect(insights.signalsSummary).toEqual({
			total: 5,
			byType: { price_drop: 2, below_market: 3, value_quality: 0 },
			asOf: '2026-07-06',
			market: 'all'
		});
	});

	it('preserves distinct windows while deduping exact scope backfills', async () => {
		const sevenDay = makeSignal('7d');
		const thirtyDay = makeSignal('30d');
		const market = configureClient([
			signalPage([thirtyDay]),
			signalPage([sevenDay]),
			signalPage([]),
			signalPage([])
		]);

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

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
		expect(insights.valueSignals?.map((signal) => signal.signalWindow)).toEqual(['7d', '30d']);
		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual([
			'Dual Window Lot',
			'Dual Window Lot'
		]);
	});

	it('uses the entitled response-hydrated name and catalog projection', async () => {
		const catalogProjection = {
			id: 202,
			name: 'Gated Wholesale Lot',
			source: 'Example Supplier',
			country: 'Brazil',
			processing: 'Natural',
			cost_lb: 3.75,
			price_per_lb: 3.75,
			wholesale: true,
			stocked: true,
			proof: {
				version: 'proof-summary-v1',
				overall: { label: 'partial', familiesWithSignals: 2 },
				families: {},
				limitations: []
			}
		};
		const wholesaleSignal = makeSignal('7d', {
			catalogId: 202,
			market: 'wholesale',
			name: 'Gated Wholesale Lot',
			coffee: catalogProjection
		});
		configureClient([
			signalPage([]),
			signalPage([]),
			signalPage([wholesaleSignal]),
			signalPage([])
		]);

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Gated Wholesale Lot']);
		expect(insights.valueSignals?.[0]?.coffee).toEqual(catalogProjection);
	});

	it('keeps Parchment response names and catalog drawer rows unchanged', async () => {
		const namedSignal = makeSignal('7d', {
			catalogId: 303,
			name: 'Parchment Named Lot',
			coffee: { id: 303, name: 'Parchment Named Lot', source: 'Example Supplier' }
		});
		configureClient([
			signalPage([namedSignal]),
			signalPage([namedSignal]),
			signalPage([]),
			signalPage([])
		]);

		const insights = await loadMarketIndexInsights(makeEvent(), { isParchmentIntelligence: true });

		expect(insights.valueSignals?.map((signal) => signal.name)).toEqual(['Parchment Named Lot']);
		expect(insights.valueSignals?.[0]?.coffee).toMatchObject({
			id: 303,
			name: 'Parchment Named Lot'
		});
	});
});
