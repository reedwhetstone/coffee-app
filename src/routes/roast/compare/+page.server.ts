import type { PageServerLoad } from './$types';
import type { RoastProfile } from '$lib/types/component.types';
import { loadProductPageData } from '$lib/server/productPageData';

// Member access is enforced for every path under `/roast` by the guard in hooks.server.ts.
export const load = (({ fetch }) => ({
	initialRoasts: loadProductPageData<{ data: RoastProfile[] }>(fetch, '/api/roast-profiles')
})) satisfies PageServerLoad;
