/** The tabs of a portfolio coffee's panel, as `?tab=` names them. */
export const PORTFOLIO_PANEL_TABS = ['overview', 'cupping', 'roasting', 'analytics'] as const;
export type PortfolioPanelTab = (typeof PORTFOLIO_PANEL_TABS)[number];

export type PortfolioSection = 'purchased' | 'bookmarked';

/** What a `/beans` link opens: a section of the portfolio, and a coffee's panel on a tab. */
export interface PortfolioUrlState {
	section: PortfolioSection;
	/** The inventory id of the coffee whose panel is open, or null when none is. */
	coffeeId: number | null;
	tab: PortfolioPanelTab;
}

const INVENTORY_ID = /^[1-9]\d*$/;

function isPanelTab(value: string | null): value is PortfolioPanelTab {
	return PORTFOLIO_PANEL_TABS.includes(value as PortfolioPanelTab);
}

/**
 * Read `/beans?coffee=<inventory id>&tab=<tab>` and `/beans?tab=bookmarked`. Bookmarked
 * lots are catalog coffees, so that section never opens a purchased coffee's panel.
 */
export function readPortfolioUrl(searchParams: URLSearchParams): PortfolioUrlState {
	const tab = searchParams.get('tab');
	if (tab === 'bookmarked') return { section: 'bookmarked', coffeeId: null, tab: 'overview' };

	const coffee = searchParams.get('coffee')?.trim() ?? '';
	const coffeeId = INVENTORY_ID.test(coffee) ? Number(coffee) : null;
	if (coffeeId === null || !Number.isSafeInteger(coffeeId)) {
		return { section: 'purchased', coffeeId: null, tab: 'overview' };
	}
	return { section: 'purchased', coffeeId, tab: isPanelTab(tab) ? tab : 'overview' };
}

/**
 * Write the open section, coffee, and tab into a `/beans` query string, leaving every other
 * parameter as it was. The Overview tab is the default and is left out.
 */
export function writePortfolioUrl(
	searchParams: URLSearchParams,
	state: PortfolioUrlState
): URLSearchParams {
	const next = new URLSearchParams(searchParams);
	next.delete('coffee');
	next.delete('tab');
	if (state.section === 'bookmarked') {
		next.set('tab', 'bookmarked');
	} else if (state.coffeeId !== null) {
		next.set('coffee', String(state.coffeeId));
		if (state.tab !== 'overview') next.set('tab', state.tab);
	}
	return next;
}

/** The link that opens a portfolio coffee's panel on a tab. */
export function portfolioCoffeeHref(
	coffeeId: number | string,
	tab: PortfolioPanelTab = 'overview'
): string {
	return tab === 'overview' ? `/beans?coffee=${coffeeId}` : `/beans?coffee=${coffeeId}&tab=${tab}`;
}
