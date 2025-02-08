import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { role } = locals;

	if (role !== 'admin') {
		throw redirect(303, '/');
	}

	const { data, error } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.order('arrival_date', { ascending: false });

	if (error) {
		throw error;
	}

	return { data: data || [] };
};
