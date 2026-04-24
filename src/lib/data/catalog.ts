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
	stockedFilter?: boolean | null; // explicit 3-way: true=stocked only, false=unstocked only, null=all; takes precedence over stockedOnly when set
	stockedDays?: number; // gte stocked_date = N days ago

	// Visibility filters (for internal catalog endpoint)
	publicOnly?: boolean; // eq public_coffee=true
	showWholesale?: boolean; // include wholesale=true rows (default: false hides them)
	wholesaleOnly?: boolean; // eq wholesale=true

	// Pagination
	limit?: number; // row limit (no offset — use range() call for paginated)
	offset?: number; // pagination offset

	// Field set
	fields?: 'full' | 'dropdown' | 'resource'; // resource → public/API projection without raw evidence blobs

	// Sorting
	orderBy?: string;
	orderDirection?: 'asc' | 'desc';

	// Catalog-specific filters (internal endpoint)
	continent?: string;
	country?: string | string[];
	source?: string[];
	processing?: string;
	processingBaseMethod?: string;
	fermentationType?: string;
	processAdditive?: string;
	hasAdditives?: boolean;
	processingDisclosureLevel?: string;
	processingConfidenceMin?: number;
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
	stockedDate?: string; // absolute lower-bound date (YYYY-MM-DD)
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

/** Options for the lightweight dropdown search. */
export interface CatalogDropdownSearchOptions {
	origin?: CatalogSearchOptions['origin'];
	stockedOnly?: boolean;
	stockedFilter?: boolean | null; // 3-way: true=stocked only, false=unstocked only, null=all; takes precedence over stockedOnly
	publicOnly?: boolean;
	showWholesale?: boolean;
	wholesaleOnly?: boolean;
	continent?: CatalogSearchOptions['continent'];
	country?: CatalogSearchOptions['country'];
	source?: CatalogSearchOptions['source'];
	processing?: CatalogSearchOptions['processing'];
	processingBaseMethod?: CatalogSearchOptions['processingBaseMethod'];
	fermentationType?: CatalogSearchOptions['fermentationType'];
	processAdditive?: CatalogSearchOptions['processAdditive'];
	hasAdditives?: CatalogSearchOptions['hasAdditives'];
	processingDisclosureLevel?: CatalogSearchOptions['processingDisclosureLevel'];
	processingConfidenceMin?: CatalogSearchOptions['processingConfidenceMin'];
	cultivarDetail?: CatalogSearchOptions['cultivarDetail'];
	type?: CatalogSearchOptions['type'];
	grade?: CatalogSearchOptions['grade'];
	appearance?: CatalogSearchOptions['appearance'];
	name?: CatalogSearchOptions['name'];
	region?: CatalogSearchOptions['region'];
	scoreValueMin?: CatalogSearchOptions['scoreValueMin'];
	scoreValueMax?: CatalogSearchOptions['scoreValueMax'];
	pricePerLbMin?: CatalogSearchOptions['pricePerLbMin'];
	pricePerLbMax?: CatalogSearchOptions['pricePerLbMax'];
	arrivalDate?: CatalogSearchOptions['arrivalDate'];
	stockedDate?: CatalogSearchOptions['stockedDate'];
	stockedDays?: CatalogSearchOptions['stockedDays'];
	orderBy?: CatalogSearchOptions['orderBy'];
	orderDirection?: CatalogSearchOptions['orderDirection'];
	limit?: number;
	offset?: number;
}

// ── Columns ──────────────────────────────────────────────────────────────────

const DROPDOWN_COLUMNS =
	'id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee' as const;

const CATALOG_RESOURCE_COLUMNS: string =
	'id, name, score_value, arrival_date, region, processing, processing_base_method, fermentation_type, process_additives, process_additive_detail, fermentation_duration_hours, processing_notes, processing_disclosure_level, processing_confidence, processing_evidence_available, drying_method, roast_recs, lot_size, bag_size, packaging, cultivar_detail, grade, appearance, description_short, farm_notes, type, description_long, link, cost_lb, price_per_lb, price_tiers, last_updated, source, stocked, cupping_notes, unstocked_date, stocked_date, ai_description, ai_tasting_notes, public_coffee, country, continent, wholesale';

const RESOURCE_MISSING_COLUMN_HINTS = [
	'processing_base_method',
	'fermentation_type',
	'process_additives',
	'process_additive_detail',
	'fermentation_duration_hours',
	'processing_notes',
	'processing_disclosure_level',
	'processing_confidence',
	'processing_evidence_available',
	'drying_method'
] as const;

const DISCLOSED_ADDITIVE_VALUES = [
	'fruit',
	'yeast',
	'hops',
	'spice',
	'botanical',
	'mossto',
	'starter-culture',
	'other'
] as const;

function isMissingColumnError(error: unknown, columnHints: readonly string[] = []): boolean {
	if (typeof error !== 'object' || error === null) return false;

	const { code, message } = error as { code?: unknown; message?: unknown };
	const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';

	return (
		code === '42703' ||
		code === 'PGRST200' ||
		normalizedMessage.includes('does not exist') ||
		columnHints.some((column) => normalizedMessage.includes(column.toLowerCase()))
	);
}

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
		stockedFilter,
		stockedDays,
		fields = 'full',

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
		processingBaseMethod,
		fermentationType,
		processAdditive,
		hasAdditives,
		processingDisclosureLevel,
		processingConfidenceMin,
		region,
		scoreValueMin,
		scoreValueMax,
		pricePerLbMin,
		pricePerLbMax,
		arrivalDate,
		stockedDate
	} = options;

	const usePagination = offset !== undefined;

	const selectColumns = fields === 'resource' ? CATALOG_RESOURCE_COLUMNS : '*';

	let query = supabase
		.from('coffee_catalog')
		// Only request an exact count when paginating — it adds an extra DB pass
		.select(selectColumns, usePagination ? { count: 'exact' } : undefined);

	// ── Visibility filters ────────────────────────────────────────────────────
	// stockedFilter takes precedence: true = stocked only, false = unstocked only, null = no filter
	// Falls back to legacy stockedOnly when stockedFilter is not provided.
	if (stockedFilter !== undefined) {
		if (stockedFilter === true) {
			query = query.eq('stocked', true);
		} else if (stockedFilter === false) {
			query = query.eq('stocked', false);
		}
		// null = no filter (all items regardless of stocked state)
	} else if (stockedOnly) {
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
	if (Array.isArray(country) && country.length > 0) {
		query = country.length === 1 ? query.eq('country', country[0]) : query.in('country', country);
	} else if (country) {
		query = query.eq('country', country);
	}
	if (region) query = query.ilike('region', `%${region}%`);
	if (source && source.length > 0) query = query.in('source', source);

	// ── Text search filters ───────────────────────────────────────────────────
	if (name) query = query.ilike('name', `%${name}%`);
	if (process) query = query.ilike('processing', `%${process}%`);
	if (processing) query = query.ilike('processing', `%${processing}%`);
	if (processingBaseMethod) query = query.eq('processing_base_method', processingBaseMethod);
	if (fermentationType) query = query.eq('fermentation_type', fermentationType);
	if (processAdditive) query = query.contains('process_additives', [processAdditive]);
	if (hasAdditives === true) {
		query = query.overlaps('process_additives', [...DISCLOSED_ADDITIVE_VALUES]);
	} else if (hasAdditives === false) {
		// false means the supplier explicitly disclosed no additives. Unknown,
		// unspecified, or mixed additive arrays are intentionally excluded so
		// missing/contradictory metadata is not treated as real no-additives data.
		query = query
			.contains('process_additives', ['none'])
			.containedBy('process_additives', ['none']);
	}
	if (processingDisclosureLevel) {
		query = query.eq('processing_disclosure_level', processingDisclosureLevel);
	}
	if (processingConfidenceMin !== undefined) {
		query = query.gte('processing_confidence', processingConfidenceMin);
	}
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
		query = query.gte('stocked_date', stockedDate);
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
	if (error) {
		if (fields === 'resource' && isMissingColumnError(error, RESOURCE_MISSING_COLUMN_HINTS)) {
			// The resource projection references processing-transparency columns added by
			// this PR. Preview/test databases can lag the migration; fall back to the
			// legacy full-row query so existing catalog endpoints keep serving data until
			// the schema is applied.
			return searchCatalog(supabase, { ...options, fields: 'full' });
		}
		throw error;
	}

	const filtersApplied: Record<string, unknown> = {};
	if (origin) filtersApplied.origin = origin;
	if (process) filtersApplied.process = process;
	if (variety) filtersApplied.variety = variety;
	if (priceRange) filtersApplied.priceRange = priceRange;
	if (flavorKeywords.length) filtersApplied.flavorKeywords = flavorKeywords;
	if (name) filtersApplied.name = name;
	if (dryingMethod) filtersApplied.dryingMethod = dryingMethod;
	if (supplier) filtersApplied.supplier = supplier;
	if (processingBaseMethod) filtersApplied.processingBaseMethod = processingBaseMethod;
	if (fermentationType) filtersApplied.fermentationType = fermentationType;
	if (processAdditive) filtersApplied.processAdditive = processAdditive;
	if (hasAdditives !== undefined) filtersApplied.hasAdditives = hasAdditives;
	if (processingDisclosureLevel)
		filtersApplied.processingDisclosureLevel = processingDisclosureLevel;
	if (processingConfidenceMin !== undefined) {
		filtersApplied.processingConfidenceMin = processingConfidenceMin;
	}
	if (coffeeIds) filtersApplied.coffeeIds = coffeeIds;
	if (stockedOnly) filtersApplied.stockedOnly = stockedOnly;
	if (stockedFilter !== undefined) filtersApplied.stockedFilter = stockedFilter;
	if (pricePerLbMin !== undefined) filtersApplied.pricePerLbMin = pricePerLbMin;
	if (pricePerLbMax !== undefined) filtersApplied.pricePerLbMax = pricePerLbMax;
	if (arrivalDate) filtersApplied.arrivalDate = arrivalDate;
	if (stockedDate) filtersApplied.stockedDate = stockedDate;
	if (stockedDays) filtersApplied.stockedDays = stockedDays;
	if (limit) filtersApplied.limit = limit;

	return {
		data: (data as unknown as CatalogItem[]) || [],
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
 * Consumers: /v1/catalog?fields=dropdown, /api/catalog?fields=dropdown, bean pickers.
 */
export async function searchCatalogDropdown(
	supabase: SupabaseClient,
	options: CatalogDropdownSearchOptions = {}
): Promise<CatalogDropdownResult> {
	const {
		origin,
		stockedOnly = true,
		stockedFilter,
		publicOnly = false,
		showWholesale,
		wholesaleOnly = false,
		continent,
		country,
		source,
		processing,
		cultivarDetail,
		type,
		grade,
		appearance,
		processingBaseMethod,
		fermentationType,
		processAdditive,
		hasAdditives,
		processingDisclosureLevel,
		processingConfidenceMin,
		name,
		region,
		scoreValueMin,
		scoreValueMax,
		pricePerLbMin,
		pricePerLbMax,
		arrivalDate,
		stockedDate,
		stockedDays,
		orderBy = 'arrival_date',
		orderDirection = 'desc',
		limit,
		offset
	} = options;
	const usePagination = offset !== undefined;

	let query = supabase
		.from('coffee_catalog')
		.select(DROPDOWN_COLUMNS, usePagination ? { count: 'exact' } : undefined);

	if (stockedFilter !== undefined) {
		if (stockedFilter === true) {
			query = query.eq('stocked', true);
		} else if (stockedFilter === false) {
			query = query.eq('stocked', false);
		}
		// null = no filter (all items regardless of stocked state)
	} else if (stockedOnly) {
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

	if (origin) {
		query = query.or(
			`continent.ilike.%${origin}%,country.ilike.%${origin}%,region.ilike.%${origin}%`
		);
	}
	if (continent) query = query.eq('continent', continent);
	if (Array.isArray(country) && country.length > 0) {
		query = country.length === 1 ? query.eq('country', country[0]) : query.in('country', country);
	} else if (country) {
		query = query.eq('country', country);
	}
	if (region) query = query.ilike('region', `%${region}%`);
	if (source && source.length > 0) query = query.in('source', source);
	if (name) query = query.ilike('name', `%${name}%`);
	if (processing) query = query.ilike('processing', `%${processing}%`);
	if (processingBaseMethod) query = query.eq('processing_base_method', processingBaseMethod);
	if (fermentationType) query = query.eq('fermentation_type', fermentationType);
	if (processAdditive) query = query.contains('process_additives', [processAdditive]);
	if (hasAdditives === true) {
		query = query.overlaps('process_additives', [...DISCLOSED_ADDITIVE_VALUES]);
	} else if (hasAdditives === false) {
		query = query
			.contains('process_additives', ['none'])
			.containedBy('process_additives', ['none']);
	}
	if (processingDisclosureLevel) {
		query = query.eq('processing_disclosure_level', processingDisclosureLevel);
	}
	if (processingConfidenceMin !== undefined) {
		query = query.gte('processing_confidence', processingConfidenceMin);
	}
	if (cultivarDetail) query = query.ilike('cultivar_detail', `%${cultivarDetail}%`);
	if (type) query = query.ilike('type', `%${type}%`);
	if (grade) query = query.ilike('grade', `%${grade}%`);
	if (appearance) query = query.ilike('appearance', `%${appearance}%`);
	if (scoreValueMin !== undefined) query = query.gte('score_value', scoreValueMin);
	if (scoreValueMax !== undefined) query = query.lte('score_value', scoreValueMax);
	if (pricePerLbMin !== undefined) query = query.gte('price_per_lb', pricePerLbMin);
	if (pricePerLbMax !== undefined) query = query.lte('price_per_lb', pricePerLbMax);
	if (arrivalDate) query = query.eq('arrival_date', arrivalDate);
	if (stockedDate && stockedDate !== '') {
		query = query.gte('stocked_date', stockedDate);
	}
	if (stockedDays && stockedDays > 0) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - stockedDays);
		query = query.gte('stocked_date', cutoff.toISOString().split('T')[0]);
	}

	query = query.order(orderBy, { ascending: orderDirection === 'asc' });

	if (offset !== undefined && limit !== undefined) {
		query = query.range(offset, offset + limit - 1);
	} else if (limit !== undefined) {
		query = query.limit(limit);
	}

	const { data, error, count } = await query;
	if (error) throw error;

	return {
		data: (data as CatalogDropdownItem[]) || [],
		count: count ?? data?.length ?? 0
	};
}

/**
 * Backward-compatible unpaginated dropdown helper for existing picker consumers.
 */
export async function getCatalogDropdown(
	supabase: SupabaseClient,
	options: Omit<CatalogDropdownSearchOptions, 'limit' | 'offset'> = {}
): Promise<CatalogDropdownItem[]> {
	const result = await searchCatalogDropdown(supabase, options);
	return result.data;
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
	'source, continent, country, processing, processing_base_method, fermentation_type, process_additives, processing_disclosure_level, cultivar_detail, type, grade, appearance, arrival_date' as const;

const FILTER_METADATA_FALLBACK_COLUMNS =
	'source, continent, country, processing, cultivar_detail, type, grade, appearance, arrival_date' as const;

const FILTER_METADATA_MISSING_COLUMN_HINTS = [
	'processing_base_method',
	'fermentation_type',
	'process_additives',
	'processing_disclosure_level'
] as const;

/** Row shape returned by the narrow filter-metadata query. */
export type CatalogFilterMetadataRow = {
	source: string | null;
	continent: string | null;
	country: string | null;
	processing: string | null;
	processing_base_method: string | null;
	fermentation_type: string | null;
	process_additives: string[] | null;
	processing_disclosure_level: string | null;
	cultivar_detail: string | null;
	type: string | null;
	grade: string | null;
	appearance: string | null;
	arrival_date: string | null;
};

/**
 * Narrow query for building filter option lists (/api/catalog/filters).
 * Selects only the columns needed for unique-value extraction instead of
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
	if (error) {
		if (!isMissingColumnError(error, FILTER_METADATA_MISSING_COLUMN_HINTS)) throw error;

		let fallbackQuery = supabase
			.from('coffee_catalog')
			.select(FILTER_METADATA_FALLBACK_COLUMNS)
			.order('arrival_date', { ascending: false });
		if (stockedOnly) fallbackQuery = fallbackQuery.eq('stocked', true);
		if (publicOnly) fallbackQuery = fallbackQuery.eq('public_coffee', true);
		if (wholesaleOnly) {
			fallbackQuery = fallbackQuery.eq('wholesale', true);
		} else if (showWholesale === false) {
			fallbackQuery = fallbackQuery.eq('wholesale', false);
		}
		const { data: fallbackData, error: fallbackError } = await fallbackQuery;
		if (fallbackError) throw fallbackError;

		return (
			(fallbackData as Array<
				Pick<
					CatalogFilterMetadataRow,
					| 'source'
					| 'continent'
					| 'country'
					| 'processing'
					| 'cultivar_detail'
					| 'type'
					| 'grade'
					| 'appearance'
					| 'arrival_date'
				>
			>) || []
		).map((row) => ({
			...row,
			processing_base_method: null,
			fermentation_type: null,
			process_additives: null,
			processing_disclosure_level: null
		}));
	}
	return (data as CatalogFilterMetadataRow[]) || [];
}
