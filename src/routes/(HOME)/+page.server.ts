import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '../(home)/$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.order('arrival_date', { ascending: false });

	if (error) {
		throw error;
	}

	return { data: data || [] };
};
