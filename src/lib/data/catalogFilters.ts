/**
 * Catalog filter business logic — pure functions extracted from filterStore.
 *
 * This module contains transformations, predicates, and lookups that operate
 * on plain data values. Nothing here touches reactive state or Svelte runes.
 * The store imports from here; consumers that only need the logic can import
 * directly without pulling in the reactive store.
 */

import type { CatalogFilterValue } from '$lib/catalog/urlState';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A generic row of unknown shape, as used in the filter/sort pipeline. */
export type DataItem = Record<string, unknown>;

// ── Route predicates ──────────────────────────────────────────────────────────

/**
 * Returns true when the route uses server-side catalog data.
 * "/" is treated as an alias for "/catalog" (the landing page IS the catalog).
 */
export function isCatalogRoute(routeId: string): boolean {
	return routeId.includes('/catalog') || routeId === '/';
}

// ── Route-specific lookups ────────────────────────────────────────────────────

/**
 * Returns the default sort field and direction for a given route.
 * Returns `{ field: null, direction: null }` for routes with no sort default.
 */
export function getDefaultSortSettings(routeId: string): {
	field: string | null;
	direction: 'asc' | 'desc' | null;
} {
	if (routeId.includes('beans')) {
		return { field: 'purchase_date', direction: 'desc' };
	} else if (routeId.includes('roast')) {
		return { field: 'roast_date', direction: 'desc' };
	} else {
		return { field: null, direction: null };
	}
}

/**
 * Returns the list of filterable column names for a specific route.
 */
export function getFilterableColumns(routeId: string): string[] {
	if (routeId.includes('beans')) {
		return [
			'name',
			'source',
			'score_value',
			'purchase_date',
			'arrival_date',
			'type',
			'grade',
			'appearance',
			'continent',
			'country',
			'region',
			'processing',
			'cultivar_detail',
			'stocked'
		];
	} else if (routeId.includes('roast')) {
		return [
			'roast_id',
			'batch_name',
			'coffee_name',
			'roast_date',
			'roast_notes',
			'roast_targets',
			'oz_in',
			'oz_out'
		];
	} else if (routeId === '/' || routeId === '/catalog') {
		return [
			'name',
			'source',
			'continent',
			'country',
			'region',
			'processing',
			'cultivar_detail',
			'type',
			'grade',
			'appearance',
			'score_value',
			'cost_lb',
			'stocked_date'
		];
	}
	return [];
}

// ── Filter value helpers ──────────────────────────────────────────────────────

/**
 * Returns true when a filter value is semantically empty and should be omitted.
 */
export function isEmptyFilterValue(value: CatalogFilterValue): boolean {
	if (value === undefined || value === null || value === '') {
		return true;
	}

	if (Array.isArray(value)) {
		return value.length === 0;
	}

	if (typeof value === 'object' && 'min' in value && 'max' in value) {
		return String(value.min ?? '').trim() === '' && String(value.max ?? '').trim() === '';
	}

	return false;
}

/**
 * Returns a new filters map with all empty values removed.
 */
export function sanitizeFilters(
	filters: Record<string, CatalogFilterValue>
): Record<string, CatalogFilterValue> {
	return Object.fromEntries(
		Object.entries(filters).filter(([, value]) => !isEmptyFilterValue(value))
	) as Record<string, CatalogFilterValue>;
}

// ── Field accessor ────────────────────────────────────────────────────────────

/**
 * Reads a field value from a data item, checking the nested `coffee_catalog`
 * sub-object first for joined beans rows, then falling back to a direct lookup.
 */
export function getFieldValue(item: DataItem, field: string): unknown {
	// Fields that might be in coffee_catalog for joined beans data
	const catalogFields = [
		'name',
		'source',
		'score_value',
		'region',
		'country',
		'continent',
		'processing',
		'cultivar_detail',
		'arrival_date',
		'cost_lb',
		'stocked_date',
		'type',
		'grade',
		'appearance'
	];

	const catalog = item.coffee_catalog as DataItem | undefined;
	if (catalogFields.includes(field) && catalog?.[field] !== undefined) {
		return catalog[field];
	}

	return item[field];
}

// ── Client-side filter / sort pipeline ───────────────────────────────────────

/**
 * Applies active filters (and wholesale visibility) to a data array.
 * Used by the client-side routes (beans, roast) that don't use server pagination.
 */
export function filterData(
	data: DataItem[],
	filters: Record<string, CatalogFilterValue>,
	showWholesale: boolean
): DataItem[] {
	// Default catalog behavior: hide wholesale unless explicitly enabled
	const wholesaleFiltered = showWholesale ? data : data.filter((item) => item.wholesale !== true);

	// Skip if no filters
	if (!Object.keys(filters).length) return wholesaleFiltered;

	return wholesaleFiltered.filter((item) => {
		return Object.entries(filters).every(([key, value]) => {
			// Skip empty filters
			if (value === undefined || value === null || value === '') return true;

			const itemValue = getFieldValue(item, key);

			// Handle stocked_date as a truthful absolute lower-bound date filter
			if (key === 'stocked_date' && typeof value === 'string' && value !== '') {
				if (!itemValue) return false;
				return String(itemValue) >= value;
			}

			// Handle stocked_days as an explicit relative "last N days" filter
			if (
				key === 'stocked_days' &&
				(typeof value === 'string' || typeof value === 'number') &&
				value !== ''
			) {
				const stockedDateValue = getFieldValue(item, 'stocked_date');
				if (!stockedDateValue) return false;

				const daysBack = Number.parseInt(String(value), 10);
				if (!Number.isFinite(daysBack) || daysBack <= 0) return true;

				const cutoffDate = new Date();
				cutoffDate.setDate(cutoffDate.getDate() - daysBack);

				const stockedDate = new Date(String(stockedDateValue));
				return stockedDate >= cutoffDate;
			}

			// Handle stocked boolean filter
			if (key === 'stocked') {
				if (value === '') return true;
				if (value === 'TRUE' || value === 'true') {
					return itemValue === true;
				} else if (value === 'FALSE' || value === 'false') {
					return itemValue === false;
				}
				return itemValue === value;
			}

			// Handle roast_id text search
			if (key === 'roast_id') {
				if (value === '') return true;
				const roastIdString = String(itemValue || '');
				const searchString = String(value || '').toLowerCase();
				return roastIdString.toLowerCase().includes(searchString);
			}

			// Handle different filter types
			if (typeof value === 'object' && value !== null) {
				// Range filter
				if (!Array.isArray(value) && 'min' in value && 'max' in value) {
					const numItemValue =
						typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
					return (
						(value.min === '' || numItemValue >= parseFloat(String(value.min))) &&
						(value.max === '' || numItemValue <= parseFloat(String(value.max)))
					);
				}

				// Array filter
				if (Array.isArray(value)) {
					// For source filtering, an empty array means show all items
					if (key === 'source' && value.length === 0) {
						return true;
					}
					return value.includes(itemValue as string);
				}
			} else if (typeof itemValue === 'string' && typeof value === 'string') {
				// Case-insensitive string search
				return itemValue.toLowerCase().includes(value.toLowerCase());
			} else {
				// Exact match
				return itemValue === value;
			}

			return true;
		});
	});
}

/**
 * Sorts a data array by the specified field and direction.
 * Returns the original array reference when no sort is requested.
 */
export function sortData(
	data: DataItem[],
	sortField: string | null,
	sortDirection: 'asc' | 'desc' | null
): DataItem[] {
	if (!sortField || !sortDirection) {
		return data;
	}

	return [...data].sort((a, b) => {
		const aValue = getFieldValue(a, sortField);
		const bValue = getFieldValue(b, sortField);

		// Nulls always sort to the end
		if (aValue == null && bValue == null) return 0;
		if (aValue == null) return 1;
		if (bValue == null) return -1;

		// Date fields: parse flexibly before comparing
		if (
			sortField === 'purchase_date' ||
			sortField === 'arrival_date' ||
			sortField === 'roast_date' ||
			sortField === 'stocked_date'
		) {
			const parseMonthYear = (dateStr: string): Date => {
				if (!dateStr) return new Date(0);

				// DD-MM-YYYY
				if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
					const [day, month, year] = dateStr.split('-').map(Number);
					return new Date(year, month - 1, day);
				}

				// YYYY-MM
				if (/^\d{4}-\d{2}$/.test(dateStr)) {
					const [year, month] = dateStr.split('-').map(Number);
					return new Date(year, month - 1);
				}

				// MySQL datetime
				if (dateStr.includes(' ')) {
					return new Date(dateStr.replace(' ', 'T') + 'Z');
				}

				// Standard YYYY-MM-DD
				return new Date(dateStr);
			};

			const dateA = parseMonthYear(String(aValue));
			const dateB = parseMonthYear(String(bValue));

			return sortDirection === 'asc'
				? dateA.getTime() - dateB.getTime()
				: dateB.getTime() - dateA.getTime();
		}

		// Numeric fields
		if (sortField === 'score_value' || sortField === 'cost_lb' || sortField === 'roast_id') {
			const numA = parseFloat(String(aValue)) || 0;
			const numB = parseFloat(String(bValue)) || 0;

			return sortDirection === 'asc' ? numA - numB : numB - numA;
		}

		// String fields
		if (typeof aValue === 'string' && typeof bValue === 'string') {
			return sortDirection === 'asc'
				? aValue.toLowerCase().localeCompare(bValue.toLowerCase())
				: bValue.toLowerCase().localeCompare(aValue.toLowerCase());
		}

		// Fallback
		const strA = String(aValue || '').toLowerCase();
		const strB = String(bValue || '').toLowerCase();

		return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
	});
}

/**
 * Applies filters then sorting — the full client-side processing pipeline.
 */
export function processData(
	data: DataItem[],
	sortField: string | null,
	sortDirection: 'asc' | 'desc' | null,
	filters: Record<string, CatalogFilterValue>,
	showWholesale: boolean
): DataItem[] {
	return sortData(filterData(data, filters, showWholesale), sortField, sortDirection);
}

// ── Array utility ─────────────────────────────────────────────────────────────

/**
 * Shallow element-by-element equality check for arrays.
 * Used by the store to detect whether filtered data actually changed.
 */
export function arraysEqual(a: unknown[], b: unknown[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
