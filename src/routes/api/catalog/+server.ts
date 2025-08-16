import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Simple in-memory cache for catalog data
let catalogCache: {
	data: any[] | null;
	timestamp: number;
} = {
	data: null,
	timestamp: 0
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession }, url }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check for specific IDs filter
		const idsParam = url.searchParams.getAll('ids');
		const requestedIds = idsParam.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

		// If specific IDs are requested, fetch them directly (bypass cache)
		if (requestedIds.length > 0) {
			console.log('Fetching specific coffee IDs from database:', requestedIds);
			const { data: rows, error } = await supabase
				.from('coffee_catalog')
				.select('*')
				.in('id', requestedIds)
				.order('name');

			if (error) throw error;
			return json(rows || []);
		}

		// Check cache first for full catalog
		const now = Date.now();
		if (catalogCache.data && now - catalogCache.timestamp < CACHE_TTL) {
			console.log('Serving catalog data from cache');
			return json(catalogCache.data);
		}

		// Cache miss or expired - fetch full catalog from database
		console.log('Fetching full catalog data from database');
		const { data: rows, error } = await supabase.from('coffee_catalog').select('*').order('name');

		if (error) throw error;

		// Update cache
		catalogCache = {
			data: rows || [],
			timestamp: now
		};

		return json(rows || []);
	} catch (error) {
		console.error('Error querying catalog:', error);
		return json({ error: 'Failed to fetch catalog data' }, { status: 500 });
	}
};
