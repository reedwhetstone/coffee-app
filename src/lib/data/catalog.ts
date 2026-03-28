/**
 * Catalog data layer — single source of truth for all coffee_catalog queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

/** Full coffee_catalog row as returned by Supabase. */
export type CatalogItem = Database['public']['Tables']['coffee_catalog']['Row'];

/** Lightweight item for dropdowns and pickers. */
export interface CatalogDropdownItem {
	id: number;
	source: string | null;
	name: string;
	stocked: boolean | null;
	cost_lb: number | null;
	price_per_lb: number | null;
	price_tiers: Database['public']['Tables']['coffee_catalog']['Row']['price_tiers'];
	public_coffee: boolean | null;
}

/** Options for the shared catalog search. */
export interface CatalogSearchOptions {
	// Content filters
	origin?: string; // matches continent, country, region (OR)
	process?: string; // ilike processing
	variety?: string; // ilike cultivar_detail
	priceRange?: [number, number]; // [min, max] on price_per_lb
	flavorKeywords?: string[]; // ilike across description/notes fields
	name?: string; // ilike name
	dryingMethod?: string; // ilike processing OR drying_method
	supplier?: string; // ilike source
	coffeeIds?: number[]; // exact IN filter

	// Stock filters
	stockedOnly?: boolean; // eq stocked=true (default: false — caller decides)
	stockedDays?: number; // gte stocked_date = N days ago

	// Visibility filters (for internal catalog endpoint)
	publicOnly?: boolean; // eq public_coffee=true
	showWholesale?: boolean; // include wholesale=true rows (default: false hides them)
	wholesaleOnly?: boolean; // eq wholesale=true

	// Pagination
	limit?: number; // row limit (no offset — use range() call for paginated)
	offset?: number; // pagination offset

	// Field set
	fields?: 'full' | 'dropdown'; // dropdown → id,source,name,stocked,cost_lb,price_tiers

	// Sorting
	orderBy?: string;
	orderDirection?: 'asc' | 'desc';

	// Catalog-specific filters (internal endpoint)
	continent?: string;
	country?: string;
	source?: string[];
	processing?: string;
	cultivarDetail?: string;
	type?: string;
	grade?: string;
	appearance?: string;
	region?: string;
	scoreValueMin?: number;
	scoreValueMax?: number;
	pricePerLbMin?: number;
	pricePerLbMax?: number;
	arrivalDate?: string;
	stockedDate?: string; // number-as-string: days back
}

/** Standard response from searchCatalog. */
export interface CatalogSearchResult {
	data: CatalogItem[];
	count: number;
	filtersApplied: Record<string, unknown>;
}

/** Response from searchCatalogDropdown (lightweight query). */
export interface CatalogDropdownResult {
	data: CatalogDropdownItem[];
	count: number;
}

// ── Columns ──────────────────────────────────────────────────────────────────

const DROPDOWN_COLUMNS =
	'id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee' as const;

/** Columns exposed via the external catalog API (excludes sensitive fields). */
export const CATALOG_API_COLUMNS = [
	'id',
	'name',
	'score_value',
	'arrival_date',
	'region',
	'processing',
	'drying_method',
	'roast_recs',
	'lot_size',
	'bag_size',
	'packaging',
	'cultivar_detail',
	'grade',
	'appearance',
	'type',
	'link',
	'cost_lb',
	'last_updated',
	'source',
	'stocked',
	'unstocked_date',
	'stocked_date',
	'ai_description',
	'ai_tasting_notes',
	'country',
	'continent'
].join(',');

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Primary catalog search — single source of truth for all query consumers.
 * Applies filters, sorting, and optional pagination. Returns data + count.
 */
export async function searchCatalog(
	supabase: SupabaseClient,
	options: CatalogSearchOptions = {}
): Promise<CatalogSearchResult> {
	const {
		origin,
		process,
		variety,
		priceRange,
		flavorKeywords = [],
		name,
		dryingMethod,
		supplier,
		coffeeIds,
		stockedOnly,
		stockedDays,
		publicOnly,
		showWholesale,
		wholesaleOnly,
		limit,
		offset,
		orderBy = 'arrival_date',
		orderDirection = 'desc',
		// Internal catalog filters
		continent,
		country,
		source,
		processing,
		cultivarDetail,
		type,
		grade,
		appearance,
		region,
		scoreValueMin,
		scoreValueMax,
		pricePerLbMin,
		pricePerLbMax,
		arrivalDate,
		stockedDate
	} = options;

	const usePagination = offset !== undefined;

	let query = supabase
		.from('coffee_catalog')
		// Only request an exact count when paginating — it adds an extra DB pass
		.select('*', usePagination ? { count: 'exact' } : undefined);

	// ── Visibility filters ────────────────────────────────────────────────────
	if (stockedOnly) {
		query = query.eq('stocked', true);
	}
	if (publicOnly) {
		query = query.eq('public_coffee', true);
	}
	if (wholesaleOnly) {
		query = query.eq('wholesale', true);
	} else if (showWholesale === false) {
		// Only filter out wholesale rows when caller explicitly opts out.
		// Default (undefined) shows all rows to preserve pre-refactor behavior.
		query = query.eq('wholesale', false);
	}

	// ── ID filter ────────────────────────────────────────────────────────────
	if (coffeeIds && coffeeIds.length > 0) {
		query = query.in('id', coffeeIds);
	}

	// ── Geographic / origin filters ───────────────────────────────────────────
	if (origin) {
		query = query.or(
			`continent.ilike.%${origin}%,country.ilike.%${origin}%,region.ilike.%${origin}%`
		);
	}
	if (continent) query = query.eq('continent', continent);
	if (country) query = query.eq('country', country);
	if (region) query = query.ilike('region', `%${region}%`);
	if (source && source.length > 0) query = query.in('source', source);

	// ── Text search filters ───────────────────────────────────────────────────
	if (name) query = query.ilike('name', `%${name}%`);
	if (process) query = query.ilike('processing', `%${process}%`);
	if (processing) query = query.ilike('processing', `%${processing}%`);
	if (variety) query = query.ilike('cultivar_detail', `%${variety}%`);
	if (cultivarDetail) query = query.ilike('cultivar_detail', `%${cultivarDetail}%`);
	if (type) query = query.ilike('type', `%${type}%`);
	if (grade) query = query.ilike('grade', `%${grade}%`);
	if (appearance) query = query.ilike('appearance', `%${appearance}%`);
	if (supplier) query = query.ilike('source', `%${supplier}%`);
	if (dryingMethod) {
		query = query.or(`processing.ilike.%${dryingMethod}%,drying_method.ilike.%${dryingMethod}%`);
	}

	// ── Flavor keyword search ─────────────────────────────────────────────────
	if (flavorKeywords.length > 0) {
		const conditions: string[] = [];
		for (const keyword of flavorKeywords) {
			conditions.push(`description_short.ilike.%${keyword}%`);
			conditions.push(`description_long.ilike.%${keyword}%`);
			conditions.push(`farm_notes.ilike.%${keyword}%`);
			conditions.push(`ai_description.ilike.%${keyword}%`);
			conditions.push(`cupping_notes.ilike.%${keyword}%`);
		}
		query = query.or(conditions.join(','));
	}

	// ── Numeric range filters ─────────────────────────────────────────────────
	if (priceRange && priceRange.length === 2) {
		query = query.gte('price_per_lb', priceRange[0]).lte('price_per_lb', priceRange[1]);
	}
	if (scoreValueMin !== undefined) query = query.gte('score_value', scoreValueMin);
	if (scoreValueMax !== undefined) query = query.lte('score_value', scoreValueMax);
	if (pricePerLbMin !== undefined) query = query.gte('price_per_lb', pricePerLbMin);
	if (pricePerLbMax !== undefined) query = query.lte('price_per_lb', pricePerLbMax);

	// ── Date filters ──────────────────────────────────────────────────────────
	if (arrivalDate) query = query.eq('arrival_date', arrivalDate);
	if (stockedDate && stockedDate !== '') {
		const daysBack = parseInt(stockedDate, 10);
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - daysBack);
		query = query.gte('stocked_date', cutoff.toISOString().split('T')[0]);
	}
	if (stockedDays && stockedDays > 0) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - stockedDays);
		query = query.gte('stocked_date', cutoff.toISOString().split('T')[0]);
	}

	// ── Sorting ───────────────────────────────────────────────────────────────
	query = query.order(orderBy, { ascending: orderDirection === 'asc' });

	// ── Pagination ────────────────────────────────────────────────────────────
	if (offset !== undefined && limit !== undefined) {
		query = query.range(offset, offset + limit - 1);
	} else if (limit !== undefined) {
		query = query.limit(limit);
	}

	const { data, error, count } = await query;
	if (error) throw error;

	const filtersApplied: Record<string, unknown> = {};
	if (origin) filtersApplied.origin = origin;
	if (process) filtersApplied.process = process;
	if (variety) filtersApplied.variety = variety;
	if (priceRange) filtersApplied.priceRange = priceRange;
	if (flavorKeywords.length) filtersApplied.flavorKeywords = flavorKeywords;
	if (name) filtersApplied.name = name;
	if (dryingMethod) filtersApplied.dryingMethod = dryingMethod;
	if (supplier) filtersApplied.supplier = supplier;
	if (coffeeIds) filtersApplied.coffeeIds = coffeeIds;
	if (stockedOnly) filtersApplied.stockedOnly = stockedOnly;
	if (pricePerLbMin !== undefined) filtersApplied.pricePerLbMin = pricePerLbMin;
	if (pricePerLbMax !== undefined) filtersApplied.pricePerLbMax = pricePerLbMax;
	if (stockedDays) filtersApplied.stockedDays = stockedDays;
	if (limit) filtersApplied.limit = limit;

	return {
		data: (data as CatalogItem[]) || [],
		count: count ?? data?.length ?? 0,
		filtersApplied
	};
}

/**
 * Fetch a single catalog item by ID. Returns null if not found.
 */
export async function getCatalogItem(
	supabase: SupabaseClient,
	id: number
): Promise<CatalogItem | null> {
	const { data, error } = await supabase.from('coffee_catalog').select('*').eq('id', id).single();

	if (error) {
		if (error.code === 'PGRST116') return null; // not found
		throw error;
	}
	return data as CatalogItem;
}

/**
 * Lightweight dropdown query — returns only the fields needed for pickers.
 * Consumers: /api/catalog?fields=dropdown, bean pickers.
 */
export async function getCatalogDropdown(
	supabase: SupabaseClient,
	options: {
		stockedOnly?: boolean;
		publicOnly?: boolean;
		showWholesale?: boolean;
		wholesaleOnly?: boolean;
	} = {}
): Promise<CatalogDropdownItem[]> {
	const { stockedOnly = true, publicOnly = false, showWholesale, wholesaleOnly = false } = options;

	let query = supabase
		.from('coffee_catalog')
		.select(DROPDOWN_COLUMNS)
		.order('arrival_date', { ascending: false });

	if (stockedOnly) {
		query = query.eq('stocked', true);
	}

	if (publicOnly) {
		query = query.eq('public_coffee', true);
	}

	if (wholesaleOnly) {
		query = query.eq('wholesale', true);
	} else if (showWholesale === false) {
		// Only filter out wholesale rows when caller explicitly opts out.
		query = query.eq('wholesale', false);
	}

	const { data, error } = await query;
	if (error) throw error;
	return (data as CatalogDropdownItem[]) || [];
}

/**
 * Fetch a batch of catalog items by IDs (legacy ?ids= support).
 * Returns rows ordered by name.
 */
export async function getCatalogItemsByIds(
	supabase: SupabaseClient,
	ids: number[]
): Promise<CatalogItem[]> {
	if (ids.length === 0) return [];
	const { data, error } = await supabase
		.from('coffee_catalog')
		.select('*')
		.in('id', ids)
		.order('name');

	if (error) throw error;
	return (data as CatalogItem[]) || [];
}

// ── Columns for filter metadata ───────────────────────────────────────────────

/** Minimal column set for building unique filter option lists. */
const FILTER_METADATA_COLUMNS =
	'source, continent, country, processing, cultivar_detail, type, grade, appearance, arrival_date' as const;

/** Row shape returned by the narrow filter-metadata query. */
export type CatalogFilterMetadataRow = {
	source: string | null;
	continent: string | null;
	country: string | null;
	processing: string | null;
	cultivar_detail: string | null;
	type: string | null;
	grade: string | null;
	appearance: string | null;
	arrival_date: string | null;
};

/**
 * Narrow query for building filter option lists (/api/catalog/filters).
 * Selects only the 9 columns needed for unique-value extraction instead of
 * fetching full rows via searchCatalog().
 */
export async function getCatalogFilterMetadata(
	supabase: SupabaseClient,
	options: {
		stockedOnly?: boolean;
		publicOnly?: boolean;
		showWholesale?: boolean;
		wholesaleOnly?: boolean;
	} = {}
): Promise<CatalogFilterMetadataRow[]> {
	const { stockedOnly, publicOnly, showWholesale, wholesaleOnly } = options;

	let query = supabase
		.from('coffee_catalog')
		.select(FILTER_METADATA_COLUMNS)
		.order('arrival_date', { ascending: false });

	if (stockedOnly) query = query.eq('stocked', true);
	if (publicOnly) query = query.eq('public_coffee', true);
	if (wholesaleOnly) {
		query = query.eq('wholesale', true);
	} else if (showWholesale === false) {
		query = query.eq('wholesale', false);
	}

	const { data, error } = await query;
	if (error) throw error;
	return (data as CatalogFilterMetadataRow[]) || [];
}

/**
 * Fetch all publicly visible catalog items with a specific column subset.
 * Used by the external catalog API.
 */
export async function getPublicCatalog(
	supabase: SupabaseClient,
	columns: string = CATALOG_API_COLUMNS
): Promise<Record<string, unknown>[]> {
	const { data, error } = await supabase
		.from('coffee_catalog')
		.select(columns)
		.eq('public_coffee', true)
		.order('name');

	if (error) throw error;
	return (data as unknown as Record<string, unknown>[]) || [];
}
