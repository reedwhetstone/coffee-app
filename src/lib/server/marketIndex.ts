import type { RequestEvent } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import { createAdminClient } from '$lib/supabase-admin';
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
const PRICE_DROP_SIGNAL_TYPES: Array<'price_drop'> = ['price_drop'];
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
	items: components['schemas']['MarketSignalItem'][]
): Promise<MarketSignalItem[]> {
	const ids = [...new Set(items.map((item) => item.catalogId))];
	const names = new Map<number, string | null>();

	for (const item of items) {
		const responseName = extractSignalName(item);
		if (responseName) names.set(item.catalogId, responseName);
	}

	const missingIds = ids.filter((id) => !names.has(id));
	if (missingIds.length > 0) {
		try {
			const adminSupabase = createAdminClient() as unknown as NameLookupClient;
			const { data } = await adminSupabase
				.from('coffee_catalog')
				.select('id, name')
				.in('id', missingIds);
			for (const row of data ?? []) {
				names.set(row.id, row.name);
			}
		} catch {
			// Names are presentation sugar; signals render from origin/process without them.
		}
	}
	return items.map((item) => ({ ...item, name: names.get(item.catalogId) ?? null }));
}

function extractSignalName(item: components['schemas']['MarketSignalItem']): string | null {
	const record = item as unknown as Record<string, unknown>;
	for (const key of ['name', 'coffeeName', 'coffee_name', 'catalogName', 'catalog_name']) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) return value;
	}
	return null;
}

function signalRank(item: components['schemas']['MarketSignalItem']): number | null {
	const record = item as unknown as Record<string, unknown>;
	const value = record.rankScore ?? record.rank_score;
	return typeof value === 'number' ? value : null;
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

	// Value signals: entitled viewers get displayed-signal pages per market,
	// including both price-drop windows (omitting window asks Parchment for the
	// 30d default, so 7d-only drops need their own page). No 'all' pages are
	// fetched: any signal in the combined top-N by rank is by definition in its
	// own market's top-N, so the per-market pages fully cover the 'all' scope
	// after the rank re-sort below.
	const SIGNAL_MARKETS = ['retail', 'wholesale'] as const;
	const SIGNAL_PAGES = [
		{ type: DISPLAY_SIGNAL_TYPES, window: '30d' as const },
		{ type: PRICE_DROP_SIGNAL_TYPES, window: '7d' as const }
	];
	const signalsPromise = isParchmentIntelligence
		? Promise.allSettled(
				SIGNAL_MARKETS.flatMap((market) =>
					SIGNAL_PAGES.map((page) =>
						client.market.signals({
							market,
							type: page.type,
							window: page.window,
							limit: MAX_SIGNAL_CARDS
						})
					)
				)
			)
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
		const signalBodies = signalsSettled.map((r) => settledBody<SignalBody>(r));
		const firstBody = signalBodies.find((body) => body !== null) ?? null;
		// Merge the per-market pages and dedupe on the API's stable signal
		// identity; price drops can legitimately qualify in both movement windows
		// for the same lot. The rank re-sort makes the 'all' scope's order
		// independent of page order.
		const merged: components['schemas']['MarketSignalItem'][] = [];
		const seen = new Set<string>();
		for (const body of signalBodies) {
			for (const item of body?.data ?? []) {
				const key = `${item.catalogId}:${item.signalType}:${item.market}:${item.signalWindow ?? ''}`;
				if (seen.has(key)) continue;
				seen.add(key);
				merged.push(item);
			}
		}
		merged.sort(
			(a, b) =>
				(signalRank(b) ?? Number.NEGATIVE_INFINITY) - (signalRank(a) ?? Number.NEGATIVE_INFINITY)
		);
		insights.signalsAsOf = firstBody?.meta?.asOf ?? null;
		if (firstBody) {
			insights.valueSignals = await enrichSignalNames(merged);
		}
		// No signalsSummary for entitled viewers: ValueSignalsSection always
		// renders the signal cards (or the honest empty state) when valueSignals
		// is set, so the teaser summary is a non-entitled-only shape.
	} else {
		const body = settledBody<SignalBody>(signalsSettled[0]);
		if (body) {
			insights.signalsAsOf = body.meta?.asOf ?? null;
			const summary = body.meta?.summary ?? null;
			if (summary) {
				// The public `summary=true` teaser is the *unfiltered* count slice —
				// it spans retail and wholesale and cannot be market-filtered without
				// entitlement (plan §3), so it is labeled all-market, never retail.
				insights.signalsSummary = {
					total: summary.total,
					byType: summary.byType,
					asOf: body.meta?.asOf ?? null,
					market: 'all'
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
