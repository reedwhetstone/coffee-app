import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	// Check for authentication
	const { session, user } = await safeGetSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

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
