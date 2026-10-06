import { track } from '@vercel/analytics/sveltekit';

/**
 * Which catalog filters and sorts get used. Events name the control only
 * ("country", "grade_code"), never what was chosen or typed, so nothing a
 * visitor searched for is sent. Vercel Analytics no-ops when its collector is
 * unavailable, including local development and blocked clients.
 */
export type CatalogFilterEvent =
	| 'catalog_filter_added'
	| 'catalog_filter_removed'
	| 'catalog_filters_cleared'
	| 'catalog_sort_changed'
	| 'catalog_filter_panel_opened'
	| 'catalog_no_results';

export function trackCatalogFilterEvent(
	event: CatalogFilterEvent,
	properties: Record<string, string | number> = {}
): void {
	track(event, { surface: 'catalog', ...properties });
}

/** The control a chip belongs to: "country" for the chip "country:Kenya". */
export function filterControl(chipId: string): string {
	return chipId.split(':')[0];
}

/**
 * The controls added and removed between two sets of active filters, each
 * named once however many of its values changed.
 */
export function changedFilterControls(
	before: readonly string[],
	after: readonly string[]
): { added: string[]; removed: string[] } {
	const previous = new Set(before);
	const next = new Set(after);
	const controls = (ids: readonly string[], other: Set<string>) => [
		...new Set(ids.filter((id) => !other.has(id)).map(filterControl))
	];
	return { added: controls(after, previous), removed: controls(before, next) };
}
