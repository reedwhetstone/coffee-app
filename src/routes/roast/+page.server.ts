import type { PageServerLoad } from './$types';
import type { RoastProfile } from '$lib/types/component.types';
import { loadProductPageData } from '$lib/server/productPageData';
export const load = (({ fetch }) => ({
	initialRoasts: loadProductPageData<{ data: RoastProfile[] }>(fetch, '/api/roast-profiles')
})) satisfies PageServerLoad;
