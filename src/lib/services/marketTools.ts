/**
 * Market intelligence data functions for the chat agent.
 *
 * These back the catalog_facets, supplier_list, and catalog_rank chat tools.
 * Results are scoped by the Parchment API to the caller's catalog visibility
 * and entitlements. Do not cache them process-wide across session clients.
 *
 * Ranking is deterministic and server-side: the LLM narrates orderings, it
 * never invents them. Purveyor Score is the single quality composite —
 * objectives change the sort, not the score.
 */

import type { ParchmentClient, components } from '@purveyors/sdk';
import { unwrapParchment } from './tools/parchment';

export type MarketToolsClient = ParchmentClient;

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Strip PostgREST filter metacharacters from app-level ilike inputs before delegating to CLI. */
function sanitizeFilterValue(value: string): string {
	return value.replace(/[%_,()]/g, ' ').trim();
}

// ─── catalog_facets ──────────────────────────────────────────────────────────

export const CATALOG_FACET_FIELDS = [
	'supplier',
	'country',
	'processing_base_method',
	'fermentation_type',
	'drying_method',
	'grade',
	'wholesale'
] as const;
export type CatalogFacetField = (typeof CATALOG_FACET_FIELDS)[number];
type CatalogFacetsResponse = components['schemas']['CatalogFacetsResponse'];
type CatalogFacetKey = keyof CatalogFacetsResponse['facets'];

export interface CatalogFacetsInput {
	field: CatalogFacetField;
	stocked_only?: boolean;
}

export interface CatalogFacetsResult {
	field: CatalogFacetField;
	stocked_only: boolean;
	scope: 'stocked_only' | 'all_visible';
	rows_examined: number | null;
	total_listings: number | null;
	distinct_values: number;
	values: Array<{ value: string; count: number }>;
	truncated: boolean | null;
}

export async function getCatalogFacets(
	client: MarketToolsClient,
	input: CatalogFacetsInput
): Promise<CatalogFacetsResult> {
	const stockedOnly = input.stocked_only ?? true;
	const response: CatalogFacetsResponse = unwrapParchment(
		await client.catalog.facets({ stocked: stockedOnly ? 'true' : 'all' })
	);
	const facetKeys: Record<CatalogFacetField, CatalogFacetKey> = {
		supplier: 'sources',
		country: 'countries',
		processing_base_method: 'processing_base_method',
		fermentation_type: 'fermentation_type',
		drying_method: 'drying_method',
		grade: 'grade',
		wholesale: 'wholesale'
	};
	const facetKey = facetKeys[input.field];
	const values = (response.facets[facetKey] ?? []) as Array<{ value: string; count: number }>;

	const result: CatalogFacetsResult = {
		field: input.field,
		stocked_only: stockedOnly,
		scope: stockedOnly ? 'stocked_only' : 'all_visible',
		// The facets endpoint does not expose a sampled-row count or truncation flag.
		// Counts can overlap for multi-valued dimensions, so they must not be summed.
		rows_examined: null,
		total_listings: null,
		distinct_values: values.length,
		values,
		truncated: null
	};

	return result;
}

// ─── supplier_list ───────────────────────────────────────────────────────────

const DEFAULT_SUPPLIER_LIMIT = 15;
const MAX_SUPPLIER_LIMIT = 25;

export interface SupplierListInput {
	stocked_only?: boolean;
	non_wholesale_only?: boolean;
	country?: string;
	limit?: number;
}

export interface SupplierSummary extends Record<string, unknown> {
	listings: number;
	non_wholesale_listings?: number;
	price_min: number | null;
	price_max: number | null;
	avg_purveyor_score: number | null;
	top_countries: string[];
}

export interface SupplierListResult {
	suppliers: SupplierSummary[];
	returned_suppliers: number;
	scope: { stocked_only: boolean; non_wholesale_only: boolean; country: string | null };
	rows_examined: number;
	caveats: string[];
	truncated: boolean;
}

type CatalogSupplierAggregate = components['schemas']['CatalogSupplierAggregate'];
type CatalogSupplierAggregateResponse = components['schemas']['CatalogSupplierAggregateResponse'];

function toSupplierSummary(
	supplier: CatalogSupplierAggregate,
	input: { nonWholesaleOnly: boolean }
): SupplierSummary {
	return {
		...supplier,
		listings: supplier.total,
		...(input.nonWholesaleOnly ? { non_wholesale_listings: supplier.total } : {}),
		price_min: supplier.price.min_per_lb,
		price_max: supplier.price.max_per_lb,
		avg_purveyor_score: supplier.score.average,
		top_countries: supplier.origins
	};
}

export async function getSupplierList(
	client: MarketToolsClient,
	input: SupplierListInput = {}
): Promise<SupplierListResult> {
	const stockedOnly = input.stocked_only ?? true;
	const country = input.country ? sanitizeFilterValue(input.country) : null;
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_SUPPLIER_LIMIT, 1), MAX_SUPPLIER_LIMIT);

	const nonWholesaleOnly = input.non_wholesale_only ?? false;
	const response: CatalogSupplierAggregateResponse = unwrapParchment(
		await client.catalog.suppliers({
			stocked: stockedOnly ? 'true' : 'false',
			country: country ?? undefined,
			nonWholesaleOnly: nonWholesaleOnly ? 'true' : 'false',
			limit
		})
	);
	const result: SupplierListResult = {
		suppliers: response.data.map((supplier) => toSupplierSummary(supplier, { nonWholesaleOnly })),
		returned_suppliers: response.meta.returned,
		scope: {
			stocked_only: stockedOnly,
			non_wholesale_only: nonWholesaleOnly,
			country
		},
		rows_examined: response.meta.rows_examined,
		caveats: response.meta.caveats,
		truncated: response.meta.truncated
	};

	return result;
}

// ─── catalog_rank ────────────────────────────────────────────────────────────

export const RANK_OBJECTIVES = ['premium', 'value', 'fresh_arrival', 'rare_origin'] as const;
export type RankObjective = (typeof RANK_OBJECTIVES)[number];
type CatalogRankingResponse = components['schemas']['CatalogRankingResponse'];

const DEFAULT_RANK_LIMIT = 8;
const MAX_RANK_LIMIT = 15;

export interface RankCatalogInput {
	objective: RankObjective;
	stocked_only?: boolean;
	supplier?: string;
	country?: string;
	process?: string;
	max_price?: number;
	min_purveyor_score?: number;
	non_wholesale_only?: boolean;
	limit?: number;
}

export interface RankedCoffee extends Record<string, unknown> {
	rank: number;
	rank_basis: string;
}

export interface RankCatalogResult {
	objective: RankObjective;
	coffees: RankedCoffee[];
	candidates_considered: number;
	caveats: string[];
	filters_applied: RankCatalogInput;
}

export async function rankCatalog(
	client: MarketToolsClient,
	input: RankCatalogInput
): Promise<RankCatalogResult> {
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_RANK_LIMIT, 1), MAX_RANK_LIMIT);
	const response: CatalogRankingResponse = unwrapParchment(
		await client.catalog.rank({
			objective: input.objective,
			stockedOnly: (input.stocked_only ?? true) ? 'true' : 'false',
			supplier: input.supplier,
			country: input.country,
			process: input.process,
			priceMax: input.max_price != null && input.max_price > 0 ? input.max_price : undefined,
			minScore:
				input.min_purveyor_score != null && input.min_purveyor_score > 0
					? input.min_purveyor_score
					: undefined,
			nonWholesaleOnly:
				input.non_wholesale_only == null ? undefined : input.non_wholesale_only ? 'true' : 'false',
			limit
		})
	);

	return {
		objective: response.meta.objective,
		coffees: response.data as unknown as RankedCoffee[],
		candidates_considered: response.meta.candidates_considered,
		caveats: response.meta.caveats,
		filters_applied: input
	};
}
