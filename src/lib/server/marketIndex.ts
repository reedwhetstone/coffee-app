import type { RequestEvent } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import { createParchmentServerClient, ParchmentConfigError } from './parchmentClient';

/**
 * BFF loader for the Market Index decision-surface modules (ADR-008 / WP-3).
 *
 * Fetches the three Parchment market-intelligence reads in parallel:
 * - value signals (full feed for Parchment Intelligence; public count summary
 *   for everyone else)
 * - price movement significance stats (public retail market-wide slice)
 * - metadata-trend index (public process slice; disclosure/score for PPI)
 *
 * Every fetch degrades to `null` on error so a Parchment outage never breaks
 * the analytics page — the sections simply don't render.
 */

import type { MarketIndexInsights, MarketSignalItem } from '$lib/types/marketIndex.types';

export type {
	MarketIndexInsights,
	MarketSignalItem,
	MarketSignalsSummary,
	MetadataSeriesItem,
	PriceMoveStat
} from '$lib/types/marketIndex.types';

const EMPTY_INSIGHTS: MarketIndexInsights = {
	valueSignals: null,
	signalsSummary: null,
	signalsAsOf: null,
	moveStats: null,
	metadataProcessSeries: null,
	metadataDisclosureSeries: null,
	metadataScoreSeries: null
};

const SIGNALS_LIMIT = 12;

interface CatalogNameRow {
	id: number;
	name: string | null;
}

/** Minimal supabase surface needed for name enrichment. */
interface NameLookupClient {
	from(table: 'coffee_catalog'): {
		select(columns: string): {
			in(column: string, values: number[]): PromiseLike<{ data: CatalogNameRow[] | null }>;
		};
	};
}

async function enrichSignalNames(
	supabase: NameLookupClient,
	items: components['schemas']['MarketSignalItem'][]
): Promise<MarketSignalItem[]> {
	const ids = [...new Set(items.map((item) => item.catalogId))];
	let names = new Map<number, string | null>();
	if (ids.length > 0) {
		try {
			const { data } = await supabase.from('coffee_catalog').select('id, name').in('id', ids);
			names = new Map((data ?? []).map((row) => [row.id, row.name]));
		} catch {
			// Names are presentation sugar; signals render from origin/process without them.
		}
	}
	return items.map((item) => ({ ...item, name: names.get(item.catalogId) ?? null }));
}

export async function loadMarketIndexInsights(
	event: RequestEvent,
	options: { isParchmentIntelligence: boolean }
): Promise<MarketIndexInsights> {
	let client: Awaited<ReturnType<typeof createParchmentServerClient>>;
	try {
		client = await createParchmentServerClient(event);
	} catch (error) {
		if (error instanceof ParchmentConfigError) {
			console.warn('Market Index insights skipped:', error.message);
			return EMPTY_INSIGHTS;
		}
		throw error;
	}

	const { isParchmentIntelligence } = options;
	const supabase = event.locals.supabase as unknown as NameLookupClient;

	const [signalsResult, statsResult, processResult, disclosureResult, scoreResult] =
		await Promise.allSettled([
			isParchmentIntelligence
				? client.market.signals({ market: 'all', limit: SIGNALS_LIMIT })
				: client.market.signals({ summary: 'true' }),
			// Public retail market-wide slice; returns rows for both movement windows.
			client.priceIndex.stats({}),
			client.market.metadataIndex({ dimension: 'process', grain: 'month' }),
			isParchmentIntelligence
				? client.market.metadataIndex({ dimension: 'disclosure', grain: 'month' })
				: Promise.resolve(null),
			isParchmentIntelligence
				? client.market.metadataIndex({ dimension: 'score', grain: 'month' })
				: Promise.resolve(null)
		]);

	const insights: MarketIndexInsights = { ...EMPTY_INSIGHTS };

	if (signalsResult.status === 'fulfilled' && signalsResult.value?.data) {
		const body = signalsResult.value.data;
		insights.signalsAsOf = body.meta?.asOf ?? null;
		if (isParchmentIntelligence) {
			insights.valueSignals = await enrichSignalNames(supabase, body.data ?? []);
		}
		const summary = body.meta?.summary ?? null;
		if (summary) {
			insights.signalsSummary = {
				total: summary.total,
				byType: summary.byType,
				asOf: body.meta?.asOf ?? null
			};
		} else if (isParchmentIntelligence) {
			// Entitled feeds still expose totals for the section header count.
			insights.signalsSummary = {
				total: body.pagination?.total ?? body.data?.length ?? 0,
				byType: { price_drop: 0, below_market: 0, value_quality: 0 },
				asOf: body.meta?.asOf ?? null
			};
		}
	}

	if (statsResult.status === 'fulfilled' && statsResult.value?.data) {
		insights.moveStats = statsResult.value.data.data ?? null;
	}

	if (processResult.status === 'fulfilled' && processResult.value?.data) {
		insights.metadataProcessSeries = processResult.value.data.data ?? null;
	}

	if (
		disclosureResult.status === 'fulfilled' &&
		disclosureResult.value &&
		'data' in disclosureResult.value &&
		disclosureResult.value.data
	) {
		insights.metadataDisclosureSeries = disclosureResult.value.data.data ?? null;
	}

	if (
		scoreResult.status === 'fulfilled' &&
		scoreResult.value &&
		'data' in scoreResult.value &&
		scoreResult.value.data
	) {
		insights.metadataScoreSeries = scoreResult.value.data.data ?? null;
	}

	return insights;
}
