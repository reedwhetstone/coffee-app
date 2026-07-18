/**
 * Catalog data types — shared type definitions for coffee_catalog consumers.
 *
 * The local search/dropdown query helpers that once lived here (searchCatalog,
 * getCatalogItem, searchCatalogDropdown, getCatalogDropdown) have been removed:
 * those specific reads are now served by the Parchment API. This does not cover
 * every coffee_catalog read in the app; other server code (e.g. analytics) still
 * queries the table directly. Only the shared types and the schema-error class
 * remain here, since live code still imports them.
 */

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
	showWholesale?: boolean; // include wholesale=true rows (default: true; false narrows to hobbyist suppliers)
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

// ── Errors ───────────────────────────────────────────────────────────────────

export class CatalogSchemaUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CatalogSchemaUnavailableError';
	}
}
