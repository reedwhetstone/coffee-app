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

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check cache first
		const now = Date.now();
		if (catalogCache.data && (now - catalogCache.timestamp) < CACHE_TTL) {
			console.log('Serving catalog data from cache');
			return json(catalogCache.data);
		}

		// Cache miss or expired - fetch from database
		console.log('Fetching catalog data from database');
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
