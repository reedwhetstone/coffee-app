import type { PageServerLoad } from '../(home)/$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get all coffees for training data
	const { data: allData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.order('arrival_date', { ascending: false });

	// Get only stocked coffees for display
	const { data: stockedData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.order('arrival_date', { ascending: false });

	return {
		data: stockedData || [],
		trainingData: allData || []
	};
};
