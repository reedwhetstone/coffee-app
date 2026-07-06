import type { RequestEvent } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import { createParchmentServerClient, ParchmentConfigError } from './parchmentClient';

/**
 * BFF loader for the Market Index decision-surface modules (ADR-008 / WP-3).
 *
 * Fetches the Parchment market-intelligence reads in parallel:
 * - value signals (full feed for Parchment Intelligence; public count summary
 *   for everyone else)
 * - price movement significance stats
 * - metadata-trend index (public process slice; disclosure trend for PPI).
 *   Cup-score trends are deliberately not fetched: supplier scores are
 *   inconsistent/subjective and are not surfaced on the front end.
 *
 * The analytics page navigates a market (retail/wholesale/all) scope toggle and
 * a movement-window (7d/30d) toggle entirely client-side, with no re-fetch, and
 * the sections match the loaded data by exact `segment.market === viewMode` and
 * `window === windowMode`. So this loader must fetch every scope+window cell the
 * viewer can select, not just the default (retail, 7d) point — otherwise the
 * value-signal cards, and the movement-significance note, silently disappear
 * when the user switches scope or window. Non-retail stat slices and the full
 * signal feed are Parchment Intelligence leverage (ADR-005), so they are only
 * requested for entitled viewers; everyone else keeps the public retail reads.
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
	metadataDisclosureSeries: null
};

/** Mirror of ValueSignalsSection's per-scope card cap so each scope gets a full page. */
const MAX_SIGNAL_CARDS = 6;
/** Signal types the front end actually displays; supplier-stated score signals stay hidden. */
const DISPLAY_SIGNAL_TYPES: Array<'price_drop' | 'below_market'> = ['price_drop', 'below_market'];
/** Movement windows the MarketReadSection window toggle can select. */
const MOVE_WINDOWS = ['7d', '30d'] as const;

type SignalBody = components['schemas']['MarketSignalsResponse'];
type StatsBody = components['schemas']['PriceIndexStatsResponse'];

/** Unwrap a settled SDK fetch result to its JSON body, or null on any failure. */
function settledBody<T>(result: PromiseSettledResult<{ data?: T } | null | undefined>): T | null {
	return result.status === 'fulfilled' ? (result.value?.data ?? null) : null;
}

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

	// Value signals: entitled viewers get a full displayed-signal page per scope
	// (the combined 'all' ranking plus retail and wholesale) so
	// ValueSignalsSection's `value_quality` and `market === viewMode` filters are
	// never starved by a single all-market cap. Everyone else gets the public
	// count summary only.
	const signalsPromise = isParchmentIntelligence
		? Promise.allSettled([
				client.market.signals({
					market: 'all',
					type: DISPLAY_SIGNAL_TYPES,
					limit: MAX_SIGNAL_CARDS
				}),
				client.market.signals({
					market: 'retail',
					type: DISPLAY_SIGNAL_TYPES,
					limit: MAX_SIGNAL_CARDS
				}),
				client.market.signals({
					market: 'wholesale',
					type: DISPLAY_SIGNAL_TYPES,
					limit: MAX_SIGNAL_CARDS
				})
			])
		: Promise.allSettled([client.market.signals({ summary: 'true' })]);

	// Movement significance: fetch the retail public slice for every viewer, plus
	// the wholesale/all Intelligence slices, across both windows, so the note is
	// populated for any scope+window the user selects.
	const statMarkets: ReadonlyArray<'retail' | 'wholesale' | 'all'> = isParchmentIntelligence
		? ['retail', 'wholesale', 'all']
		: ['retail'];
	const statsPromise = Promise.allSettled(
		statMarkets.flatMap((market) =>
			MOVE_WINDOWS.map((window) => client.priceIndex.stats({ market, window }))
		)
	);

	const metadataPromise = Promise.allSettled([
		client.market.metadataIndex({ dimension: 'process', grain: 'month' }),
		isParchmentIntelligence
			? client.market.metadataIndex({ dimension: 'disclosure', grain: 'month' })
			: Promise.resolve(null)
	]);

	const [signalsSettled, statsSettled, [processResult, disclosureResult]] = await Promise.all([
		signalsPromise,
		statsPromise,
		metadataPromise
	]);

	const insights: MarketIndexInsights = { ...EMPTY_INSIGHTS };

	if (isParchmentIntelligence) {
		const [allBody, retailBody, wholesaleBody] = signalsSettled.map((r) =>
			settledBody<SignalBody>(r)
		);
		// Merge with the combined 'all' ranking first so the 'all' scope keeps the
		// true top signals, then backfill the per-market pages. Dedupe on the
		// API's stable signal identity; price drops can legitimately qualify in
		// both movement windows for the same lot.
		const merged: components['schemas']['MarketSignalItem'][] = [];
		const seen = new Set<string>();
		for (const body of [allBody, retailBody, wholesaleBody]) {
			for (const item of body?.data ?? []) {
				const key = `${item.catalogId}:${item.signalType}:${item.market}:${item.signalWindow ?? ''}`;
				if (seen.has(key)) continue;
				seen.add(key);
				merged.push(item);
			}
		}
		insights.signalsAsOf = allBody?.meta?.asOf ?? retailBody?.meta?.asOf ?? null;
		if (allBody || retailBody || wholesaleBody) {
			insights.valueSignals = await enrichSignalNames(supabase, merged);
		}
		const summary = allBody?.meta?.summary ?? null;
		if (summary) {
			insights.signalsSummary = {
				total: summary.total,
				byType: summary.byType,
				asOf: allBody?.meta?.asOf ?? null,
				market: 'all'
			};
		} else if (allBody || merged.length > 0) {
			// The 'all' page is unfiltered by market, so its pagination total is the
			// entitled-feed total used for the section header count.
			insights.signalsSummary = {
				total: allBody?.pagination?.total ?? merged.length,
				byType: { price_drop: 0, below_market: 0, value_quality: 0 },
				asOf: allBody?.meta?.asOf ?? null,
				market: 'all'
			};
		}
	} else {
		const body = settledBody<SignalBody>(signalsSettled[0]);
		if (body) {
			insights.signalsAsOf = body.meta?.asOf ?? null;
			const summary = body.meta?.summary ?? null;
			if (summary) {
				insights.signalsSummary = {
					total: summary.total,
					byType: summary.byType,
					asOf: body.meta?.asOf ?? null,
					market: 'retail'
				};
			}
		}
	}

	const moveStats: components['schemas']['PriceMoveStatsItem'][] = [];
	for (const result of statsSettled) {
		const body = settledBody<StatsBody>(result);
		if (body?.data) moveStats.push(...body.data);
	}
	if (moveStats.length > 0) insights.moveStats = moveStats;

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

	return insights;
}
