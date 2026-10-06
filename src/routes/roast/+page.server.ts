import type { PageServerLoad } from './$types';
import { loadProductPageData } from '$lib/server/productPageData';
import { principalHasRole } from '$lib/server/principal';
import {
	readRoastListFilters,
	roastListFilterKey,
	roastListQuery,
	ROAST_PAGE_SIZE
} from '$lib/roast/roast-list-filters';
import type { RoastListPage } from '$lib/roast/roast-list-loader';

export const load = (({ fetch, locals, url, untrack }) => {
	// The guard in hooks.server.ts lets a signed-in account without Mallard Studio read this
	// page and no other under `/roast`. It gets the locked page: no roast request is made and
	// no roast data is sent, whatever the query string asks for.
	if (!principalHasRole(locals.principal, 'member')) {
		return { roastsLocked: true as const };
	}

	// The first page of roasts for the filters in the address. The address is read without
	// tracking it, so changing a filter or opening a roast does not run this load again: the
	// page asks for the next list itself.
	const filters = untrack(() => readRoastListFilters(url.searchParams));
	const query = roastListQuery(filters, { limit: ROAST_PAGE_SIZE, offset: 0 }, new Date());

	return {
		roastsLocked: false as const,
		initialRoastsKey: roastListFilterKey(filters),
		// A date preset counts back from the member's own calendar day, which only the browser
		// knows, so the page asks for that list once it is there.
		initialRoasts: filters.range
			? null
			: loadProductPageData<RoastListPage>(fetch, `/api/roast-profiles?${query}`)
	};
}) satisfies PageServerLoad;
