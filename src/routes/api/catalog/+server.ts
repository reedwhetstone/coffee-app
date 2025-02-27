import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { data: rows, error } = await supabase.from('coffee_catalog').select('*').order('name');

		if (error) throw error;

		return json(rows || []);
	} catch (error) {
		console.error('Error querying catalog:', error);
		return json({ error: 'Failed to fetch catalog data' }, { status: 500 });
	}
};
