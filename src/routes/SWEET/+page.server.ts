import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/db';

export async function load() {
	try {
		const { data, error: queryError } = await supabase
			.from('coffee_catalog')
			.select('*')
			.order('arrival_date', { ascending: false });

		if (queryError) throw queryError;

		return { data };
	} catch (err) {
		console.error('Database error:', err);
		throw error(500, 'Failed to fetch coffee data');
	}
}
