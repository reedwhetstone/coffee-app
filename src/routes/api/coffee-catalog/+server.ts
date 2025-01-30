import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase } }) => {
	const { data, error } = await supabase
		.from('coffee_catalog')
		.select('*')
		.order('arrival_date', { ascending: false });

	if (error) {
		console.error('Supabase query error:', error);
		return json({ error: error.message }, { status: 500 });
	}

	return json({ data: data || [] });
};
