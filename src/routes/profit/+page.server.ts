import type { PageServerLoad } from './$types';
import { loadProductPageData } from '$lib/server/productPageData';
export const load = (({ fetch }) => ({
	initialProfit: loadProductPageData<{ sales: unknown[]; profit: unknown[] }>(fetch, '/api/profit')
})) satisfies PageServerLoad;
