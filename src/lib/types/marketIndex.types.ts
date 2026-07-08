import type { components } from '@purveyors/sdk';
import type { CoffeeCatalog } from '$lib/types/component.types';

/**
 * Shared (client-safe) types for the Market Index decision-surface modules.
 * Type-only SDK imports are erased at build time, so these are safe to use
 * from components; the server loader lives in $lib/server/marketIndex.
 */

export type MarketSignalItem = components['schemas']['MarketSignalItem'] & {
	/** Coffee name from the entitled Parchment response or authorized server enrichment. */
	name: string | null;
	/** Catalog row for rendering the canonical CoffeeCard detail drawer on non-catalog surfaces. */
	coffee?: CoffeeCatalog | null;
};

export interface MarketSignalsSummary {
	total: number;
	byType: { price_drop: number; below_market: number; value_quality: number };
	asOf: string | null;
	market: 'retail' | 'all';
}

export type PriceMoveStat = components['schemas']['PriceMoveStatsItem'];
export type MetadataSeriesItem = components['schemas']['MetadataSeriesItem'];

export interface MarketIndexInsights {
	valueSignals: MarketSignalItem[] | null;
	signalsSummary: MarketSignalsSummary | null;
	signalsAsOf: string | null;
	moveStats: PriceMoveStat[] | null;
	metadataProcessSeries: MetadataSeriesItem[] | null;
	metadataDisclosureSeries: MetadataSeriesItem[] | null;
	metadataPurveyorScoreSeries: MetadataSeriesItem[] | null;
	metadataPurveyorScoreConfidenceSeries: MetadataSeriesItem[] | null;
	metadataPurveyorScoreTierSeries: MetadataSeriesItem[] | null;
}
