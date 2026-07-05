import type { components } from '@purveyors/sdk';

/**
 * Shared (client-safe) types for the Market Index decision-surface modules.
 * Type-only SDK imports are erased at build time, so these are safe to use
 * from components; the server loader lives in $lib/server/marketIndex.
 */

export type MarketSignalItem = components['schemas']['MarketSignalItem'] & {
	/** Coffee name enriched from coffee_catalog (the API item carries ids only). */
	name: string | null;
};

export interface MarketSignalsSummary {
	total: number;
	byType: { price_drop: number; below_market: number; value_quality: number };
	asOf: string | null;
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
	metadataScoreSeries: MetadataSeriesItem[] | null;
}
