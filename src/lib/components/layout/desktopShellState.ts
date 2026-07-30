import type { CatalogFilterValue } from '$lib/catalog/urlState';

export const DESKTOP_SHELL_CONTENT_MARGIN = 'md:ml-20 xl:ml-72';

type FilterBadgeState = {
	showWholesale: boolean;
	wholesaleOnly: boolean;
	filters: Record<string, CatalogFilterValue>;
};

function hasFilterValue(value: CatalogFilterValue): boolean {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'string') return value.trim().length > 0;
	if (typeof value === 'boolean') return value;
	return value !== null && value !== undefined;
}

export function countActiveCatalogFilters(state: FilterBadgeState): number {
	const fieldFilterCount = Object.values(state.filters).filter(hasFilterValue).length;
	const supplierVisibilityCount = state.wholesaleOnly || !state.showWholesale ? 1 : 0;

	return fieldFilterCount + supplierVisibilityCount;
}
