import { createServerSupabaseClient } from '$lib/supabase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	try {
		const { data, error } = await supabase
			.from('coffee_catalog')
			.select('*')
			.order('arrival_date', { ascending: false });

		if (error) {
			console.error('Supabase query error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ data: data || [] });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch coffee catalog data' });
	}
};
