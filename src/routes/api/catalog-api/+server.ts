import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cache for catalog API data
let catalogApiCache: {
	data: any[] | null;
	timestamp: number;
} = {
	data: null,
	timestamp: 0
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Columns to include in catalog API (excluding sensitive/unnecessary fields)
const CATALOG_API_COLUMNS = [
	'id',
	'name',
	'score_value',
	'arrival_date',
	'region',
	'processing',
	'drying_method',
	'roast_recs',
	'lot_size',
	'bag_size',
	'packaging',
	'cultivar_detail',
	'grade',
	'appearance',
	'type',
	'link',
	'cost_lb',
	'last_updated',
	'source',
	'stocked',
	'unstocked_date',
	'stocked_date',
	'ai_description',
	'ai_tasting_notes',
	'country',
	'continent'
].join(',');

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		// Require authentication and member access for paid API service
		const { session } = await safeGetSession();
		if (!session) {
			return json({ 
				error: 'Authentication required',
				message: 'This is a paid API service that requires authentication'
			}, { status: 401 });
		}

		// Check user role - require member access
		const { data: userRole, error: roleError } = await supabase
			.from('user_roles')
			.select('role')
			.eq('id', session.user.id)
			.single();

		if (roleError || !userRole || userRole.role !== 'member') {
			return json({ 
				error: 'Insufficient permissions',
				message: 'Member access required for catalog API'
			}, { status: 403 });
		}

		// Check cache first
		const now = Date.now();
		if (catalogApiCache.data && now - catalogApiCache.timestamp < CACHE_TTL) {
			console.log('Serving catalog API data from cache');
			return json({
				data: catalogApiCache.data,
				total: catalogApiCache.data?.length || 0,
				cached: true,
				cache_timestamp: new Date(catalogApiCache.timestamp).toISOString()
			});
		}

		console.log('Fetching catalog API data from database');
		
		// Fetch only public coffees with specified columns
		const { data: rows, error } = await supabase
			.from('coffee_catalog')
			.select(CATALOG_API_COLUMNS)
			.eq('public_coffee', true)
			.order('name');

		if (error) {
			console.error('Database error:', error);
			throw error;
		}

		// Update cache
		catalogApiCache = {
			data: rows || [],
			timestamp: now
		};

		// Return API response with metadata
		return json({
			data: rows || [],
			total: rows?.length || 0,
			cached: false,
			last_updated: new Date().toISOString(),
			api_version: '1.0'
		});
	} catch (error) {
		console.error('Error querying catalog API:', error);
		return json({ 
			error: 'Failed to fetch catalog data',
			message: 'Internal server error'
		}, { status: 500 });
	}
};