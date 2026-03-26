import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';

export const load: PageServerLoad = async ({ locals }) => {
	let recentArrivals: Record<string, unknown>[] = [];

	try {
		const result = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			orderBy: 'arrival_date',
			orderDirection: 'desc',
			limit: 6
		});
		recentArrivals = result.data as unknown as Record<string, unknown>[];
	} catch (error) {
		console.error('Error loading dashboard arrivals preview:', error);
	}

	return {
		recentArrivals
	};
};
