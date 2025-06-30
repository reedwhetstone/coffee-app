import type { PageServerLoad } from '../(home)/$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get recent coffees with limit to prevent large initial loads
	// Most users will interact with recent arrivals first
	const { data: allData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.order('arrival_date', { ascending: false })
		.limit(500); // Reasonable limit for performance while maintaining functionality

	// Filter stocked coffees client-side to avoid duplicate query
	const stockedData = allData?.filter((coffee) => coffee.stocked) || [];

	return {
		data: stockedData,
		trainingData: allData || []
	};
};
