import type { CatalogFilterValue } from '$lib/catalog/urlState';
import { isEmptyFilterValue } from '$lib/data/catalogFilters';

export const DESKTOP_SHELL_CONTENT_MARGIN = 'md:ml-24';

type FilterBadgeState = {
	routeId: string;
	showWholesale: boolean;
	wholesaleOnly: boolean;
	filters: Record<string, CatalogFilterValue>;
};

export function countActiveCatalogFilters(state: FilterBadgeState): number {
	const fieldFilterCount = Object.values(state.filters).filter(
		(value) => !isEmptyFilterValue(value)
	).length;
	const supplierVisibilityCount =
		state.routeId === '/catalog' && (state.wholesaleOnly || !state.showWholesale) ? 1 : 0;

	return fieldFilterCount + supplierVisibilityCount;
}
