import { buildCatalogRequestParams } from '$lib/catalog/urlState';
import type { ActiveCatalogFilter, CatalogFilterSnapshot } from '$lib/catalog/filterModel';

/** One filter that, removed on its own, would bring results back. */
export interface FilterRemovalSuggestion {
	filter: ActiveCatalogFilter;
	/** How many coffees match with that one filter removed. */
	total: number;
}

/** How many active filters are tried. Each one costs a small listing read. */
const MAX_FILTERS_TRIED = 8;

/**
 * The filters as they would be with one removed. Null for a chip whose removal
 * can only narrow the results (showing out-of-stock coffees too).
 */
export function withoutActiveFilter(
	snapshot: CatalogFilterSnapshot,
	filter: ActiveCatalogFilter
): CatalogFilterSnapshot | null {
	if (filter.remove.kind === 'includeUnstocked') return null;
	if (filter.remove.kind === 'supplierScope') {
		return { ...snapshot, showWholesale: true, wholesaleOnly: false };
	}
	const { key, value } = filter.remove;
	const filters = { ...snapshot.filters };
	const cleared = value === '' || (Array.isArray(value) && value.length === 0);
	if (cleared) delete filters[key];
	else filters[key] = value;
	return { ...snapshot, filters };
}

/** The listing request that returns only the total for a set of filters. */
export function catalogTotalRequest(snapshot: CatalogFilterSnapshot): string {
	const params = buildCatalogRequestParams({
		filters: snapshot.filters,
		sortField: null,
		sortDirection: null,
		showWholesale: snapshot.showWholesale,
		wholesaleOnly: snapshot.wholesaleOnly,
		...(snapshot.includeUnstocked ? { includeUnstocked: true } : {}),
		pagination: { page: 1, limit: 1 }
	});
	params.set('projection', 'summary');
	return `/api/catalog?${params.toString()}`;
}

async function readCatalogTotal(
	snapshot: CatalogFilterSnapshot,
	signal: AbortSignal
): Promise<number> {
	const response = await fetch(catalogTotalRequest(snapshot), { signal });
	if (!response.ok) throw new Error('Catalog total unavailable');
	const total = (await response.json())?.pagination?.total;
	if (typeof total !== 'number') throw new Error('Catalog total unavailable');
	return total;
}

/**
 * When nothing matches, which single filter to remove to see coffees again,
 * most coffees first. A filter whose removal still matches nothing is left
 * out, and one whose total cannot be read is skipped.
 */
export async function suggestFilterRemovals(
	snapshot: CatalogFilterSnapshot,
	activeFilters: readonly ActiveCatalogFilter[],
	signal: AbortSignal,
	readTotal: typeof readCatalogTotal = readCatalogTotal
): Promise<FilterRemovalSuggestion[]> {
	const candidates = activeFilters
		.map((filter) => ({ filter, without: withoutActiveFilter(snapshot, filter) }))
		.filter(
			(candidate): candidate is { filter: ActiveCatalogFilter; without: CatalogFilterSnapshot } =>
				candidate.without !== null
		)
		.slice(0, MAX_FILTERS_TRIED);
	const totals = await Promise.all(
		candidates.map(async ({ filter, without }) => {
			try {
				return { filter, total: await readTotal(without, signal) };
			} catch {
				return null;
			}
		})
	);
	return totals
		.filter((entry): entry is FilterRemovalSuggestion => entry !== null && entry.total > 0)
		.sort((a, b) => b.total - a.total);
}
