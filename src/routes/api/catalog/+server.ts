import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Simple in-memory cache for catalog data
let catalogCache: {
	data: Record<string, unknown>[] | null;
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

		// Check for specific IDs filter (legacy support)
		const idsParam = url.searchParams.getAll('ids');
		const requestedIds = idsParam.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

		if (requestedIds.length > 0) {
			const { data: rows, error } = await supabase
				.from('coffee_catalog')
				.select('*')
				.in('id', requestedIds)
				.order('name');

			if (error) throw error;
			return json(rows || []);
		}

		// Extract pagination parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '15');
		const offset = (page - 1) * limit;

		// Extract filter parameters
		const filters = {
			continent: url.searchParams.get('continent'),
			country: url.searchParams.get('country'),
			source: url.searchParams.getAll('source'),
			processing: url.searchParams.get('processing'),
			cultivar_detail: url.searchParams.get('cultivar_detail'),
			type: url.searchParams.get('type'),
			grade: url.searchParams.get('grade'),
			appearance: url.searchParams.get('appearance'),
			score_value_min: url.searchParams.get('score_value_min'),
			score_value_max: url.searchParams.get('score_value_max'),
			cost_lb_min: url.searchParams.get('cost_lb_min'),
			cost_lb_max: url.searchParams.get('cost_lb_max'),
			arrival_date: url.searchParams.get('arrival_date'),
			stocked_date: url.searchParams.get('stocked_date'),
			name: url.searchParams.get('name'),
			region: url.searchParams.get('region')
		};

		// Extract sort parameters
		const sortField = url.searchParams.get('sortField');
		const sortDirection = url.searchParams.get('sortDirection') as 'asc' | 'desc' | null;

		// Check if this is a paginated request
		const isPaginated = url.searchParams.has('page') || url.searchParams.has('limit');

		if (isPaginated) {
			// Debug: Log filter parameters
			//	console.log('Received filter parameters:', filters);

			// Build query with server-side filtering and sorting
			let query = supabase
				.from('coffee_catalog')
				.select('*', { count: 'exact' })
				.eq('stocked', true);

			// Apply filters
			if (filters.continent) query = query.eq('continent', filters.continent);
			if (filters.country) query = query.eq('country', filters.country);
			if (filters.source.length > 0) query = query.in('source', filters.source);
			if (filters.processing) query = query.ilike('processing', `%${filters.processing}%`);
			if (filters.cultivar_detail)
				query = query.ilike('cultivar_detail', `%${filters.cultivar_detail}%`);
			if (filters.type) query = query.ilike('type', `%${filters.type}%`);
			if (filters.grade) query = query.ilike('grade', `%${filters.grade}%`);
			if (filters.appearance) query = query.ilike('appearance', `%${filters.appearance}%`);
			if (filters.name) query = query.ilike('name', `%${filters.name}%`);
			if (filters.region) query = query.ilike('region', `%${filters.region}%`);

			// Apply numeric range filters
			if (filters.score_value_min)
				query = query.gte('score_value', parseFloat(filters.score_value_min));
			if (filters.score_value_max)
				query = query.lte('score_value', parseFloat(filters.score_value_max));
			if (filters.cost_lb_min) query = query.gte('cost_lb', parseFloat(filters.cost_lb_min));
			if (filters.cost_lb_max) query = query.lte('cost_lb', parseFloat(filters.cost_lb_max));

			// Apply date filters
			if (filters.arrival_date) query = query.eq('arrival_date', filters.arrival_date);
			if (filters.stocked_date && filters.stocked_date !== '') {
				const daysBack = parseInt(filters.stocked_date);
				const cutoffDate = new Date();
				cutoffDate.setDate(cutoffDate.getDate() - daysBack);
				const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
				query = query.gte('stocked_date', cutoffDateStr);
			}

			// Apply sorting (default to arrival_date desc if no sort specified)
			const defaultSortField = sortField || 'arrival_date';
			const defaultSortDirection = sortDirection || 'desc';
			query = query.order(defaultSortField, { ascending: defaultSortDirection === 'asc' });

			// Apply pagination
			const { data: rows, error, count } = await query.range(offset, offset + limit - 1);

			if (error) throw error;

			const totalPages = Math.ceil((count || 0) / limit);

			return json({
				data: rows || [],
				pagination: {
					page,
					limit,
					total: count || 0,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			});
		}

		// Legacy full catalog fetch (for backwards compatibility)
		const now = Date.now();
		if (catalogCache.data && now - catalogCache.timestamp < CACHE_TTL) {
			return json(catalogCache.data);
		}

		const { data: rows, error } = await supabase
			.from('coffee_catalog')
			.select('*')
			.eq('stocked', true)
			.order('arrival_date', { ascending: false });

		if (error) throw error;

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
