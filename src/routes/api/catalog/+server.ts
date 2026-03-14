import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCatalogItemsByIds, getCatalogDropdown, searchCatalog } from '$lib/data/catalog';

// Simple in-memory cache for catalog data (keyed by wholesale visibility mode)
const catalogCache: Record<
	string,
	{
		data: Record<string, unknown>[] | null;
		timestamp: number;
	}
> = {};

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
			const rows = await getCatalogItemsByIds(supabase, requestedIds);
			return json(rows);
		}

		// Extract pagination parameters
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '15');
		const offset = (page - 1) * limit;

		// Extract filter parameters
		const filters = {
			continent: url.searchParams.get('continent') ?? undefined,
			country: url.searchParams.get('country') ?? undefined,
			source: url.searchParams.getAll('source'),
			processing: url.searchParams.get('processing') ?? undefined,
			cultivar_detail: url.searchParams.get('cultivar_detail') ?? undefined,
			type: url.searchParams.get('type') ?? undefined,
			grade: url.searchParams.get('grade') ?? undefined,
			appearance: url.searchParams.get('appearance') ?? undefined,
			score_value_min: url.searchParams.get('score_value_min'),
			score_value_max: url.searchParams.get('score_value_max'),
			cost_lb_min: url.searchParams.get('cost_lb_min'),
			cost_lb_max: url.searchParams.get('cost_lb_max'),
			arrival_date: url.searchParams.get('arrival_date') ?? undefined,
			stocked_date: url.searchParams.get('stocked_date') ?? undefined,
			name: url.searchParams.get('name') ?? undefined,
			region: url.searchParams.get('region') ?? undefined
		};

		// Extract sort parameters
		const sortField = url.searchParams.get('sortField') ?? undefined;
		const sortDirection = (url.searchParams.get('sortDirection') as 'asc' | 'desc') ?? undefined;

		// Wholesale visibility parameters
		const showWholesale = url.searchParams.get('showWholesale') === 'true';
		const wholesaleOnly = url.searchParams.get('wholesaleOnly') === 'true';

		// Check if this is a paginated request
		const isPaginated = url.searchParams.has('page') || url.searchParams.has('limit');

		if (isPaginated) {
			const result = await searchCatalog(supabase, {
				stockedOnly: true,
				showWholesale,
				wholesaleOnly,
				continent: filters.continent,
				country: filters.country,
				source: filters.source.length > 0 ? filters.source : undefined,
				processing: filters.processing,
				cultivarDetail: filters.cultivar_detail,
				type: filters.type,
				grade: filters.grade,
				appearance: filters.appearance,
				name: filters.name,
				region: filters.region,
				scoreValueMin: filters.score_value_min ? parseFloat(filters.score_value_min) : undefined,
				scoreValueMax: filters.score_value_max ? parseFloat(filters.score_value_max) : undefined,
				costLbMin: filters.cost_lb_min ? parseFloat(filters.cost_lb_min) : undefined,
				costLbMax: filters.cost_lb_max ? parseFloat(filters.cost_lb_max) : undefined,
				arrivalDate: filters.arrival_date,
				stockedDate: filters.stocked_date,
				orderBy: sortField || 'arrival_date',
				orderDirection: sortDirection || 'desc',
				limit,
				offset
			});

			const totalPages = Math.ceil((result.count || 0) / limit);

			return json({
				data: result.data,
				pagination: {
					page,
					limit,
					total: result.count || 0,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			});
		}

		// Legacy full catalog fetch (for backwards compatibility)
		const fieldsParam = url.searchParams.get('fields');

		const now = Date.now();
		const cacheKey = wholesaleOnly
			? `wholesaleOnly_${fieldsParam ?? 'full'}`
			: showWholesale
				? `showWholesale_${fieldsParam ?? 'full'}`
				: `retailOnly_${fieldsParam ?? 'full'}`;
		const cached = catalogCache[cacheKey];
		if (cached?.data && now - cached.timestamp < CACHE_TTL) {
			return json(cached.data);
		}

		let rowsData: Record<string, unknown>[];

		if (fieldsParam === 'dropdown') {
			const dropdownRows = await getCatalogDropdown(supabase, {
				stockedOnly: true,
				showWholesale,
				wholesaleOnly
			});
			rowsData = dropdownRows as unknown as Record<string, unknown>[];
		} else {
			const result = await searchCatalog(supabase, {
				stockedOnly: true,
				showWholesale,
				wholesaleOnly,
				orderBy: 'arrival_date',
				orderDirection: 'desc'
			});
			rowsData = result.data as unknown as Record<string, unknown>[];
		}

		catalogCache[cacheKey] = {
			data: rowsData,
			timestamp: now
		};

		return json(rowsData);
	} catch (error) {
		console.error('Error querying catalog:', error);
		return json({ error: 'Failed to fetch catalog data' }, { status: 500 });
	}
};
