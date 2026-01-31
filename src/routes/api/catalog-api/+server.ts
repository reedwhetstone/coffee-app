import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	validateApiRequest,
	logApiUsage,
	checkRateLimit,
	getUserApiTier,
	getApiRowLimit
} from '$lib/server/apiAuth';
import { createAdminClient } from '$lib/supabase-admin';

// Cache for catalog API data
let catalogApiCache: {
	data: Record<string, unknown>[] | null;
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

export const GET: RequestHandler = async ({ request }) => {
	const startTime = Date.now();
	let apiKeyId: string | undefined;

	try {
		// Validate API key from Bearer token
		const { valid, userId, keyId, error: authError } = await validateApiRequest(request);

		if (!valid) {
			return json(
				{
					error: 'Authentication required',
					message: authError || 'Valid API key required for access'
				},
				{ status: 401 }
			);
		}

		if (!keyId) {
			return json(
				{
					error: 'Authentication required',
					message: 'API key validation failed'
				},
				{ status: 401 }
			);
		}

		apiKeyId = keyId;
		const supabase = createAdminClient();

		// Check user role - require API access only
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: userRoleData, error: roleError } = await (supabase as any)
			.from('user_roles')
			.select('user_role')
			.eq('id', userId)
			.single();

		// Any authenticated user can access API endpoints (viewer gets free tier, others get enhanced access)
		const hasApiAccess = userRoleData && !roleError;

		if (roleError || !hasApiAccess) {
			// Log failed request
			if (apiKeyId) {
				await logApiUsage(
					apiKeyId,
					'/api/catalog-api',
					403,
					Date.now() - startTime,
					request.headers.get('User-Agent') || undefined,
					request.headers.get('X-Forwarded-For') || undefined
				);
			}

			return json(
				{
					error: 'Insufficient permissions',
					message: 'API subscription required for catalog API access'
				},
				{ status: 403 }
			);
		}

		// Get user's API tier and determine limits
		const userRoles = userRoleData?.user_role || ['viewer'];
		const userTier = getUserApiTier(userRoles.join(','));
		const rowLimit = getApiRowLimit(userTier);

		// Check rate limit (map tier to legacy format for compatibility)
		const legacyTier =
			userTier === 'viewer'
				? 'api_viewer'
				: userTier === 'api-member'
					? 'api_member'
					: 'api_enterprise';
		const rateLimitResult = await checkRateLimit(apiKeyId, legacyTier);

		if (!rateLimitResult.allowed) {
			// Log rate limited request
			await logApiUsage(
				apiKeyId,
				'/api/catalog-api',
				429,
				Date.now() - startTime,
				request.headers.get('User-Agent') || undefined,
				request.headers.get('X-Forwarded-For') || undefined
			);

			return json(
				{
					error: 'Rate limit exceeded',
					message: 'API rate limit exceeded for your subscription plan',
					limit: rateLimitResult.limit,
					remaining: rateLimitResult.remaining,
					resetTime: rateLimitResult.resetTime
				},
				{
					status: 429,
					headers: {
						'X-RateLimit-Limit': rateLimitResult.limit.toString(),
						'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
						'X-RateLimit-Reset': Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString(),
						'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
					}
				}
			);
		}

		// Check cache first
		const now = Date.now();
		if (catalogApiCache.data && now - catalogApiCache.timestamp < CACHE_TTL) {
			console.log('Serving catalog API data from cache');

			// Apply row limiting for free tier
			let responseData = catalogApiCache.data;
			let isLimited = false;
			if (rowLimit > 0 && catalogApiCache.data.length > rowLimit) {
				responseData = catalogApiCache.data.slice(0, rowLimit);
				isLimited = true;
			}

			// Log successful cached request
			await logApiUsage(
				apiKeyId,
				'/api/catalog-api',
				200,
				Date.now() - startTime,
				request.headers.get('User-Agent') || undefined,
				request.headers.get('X-Forwarded-For') || undefined
			);

			const response = json({
				data: responseData,
				total: responseData?.length || 0,
				total_available: catalogApiCache.data?.length || 0,
				limited: isLimited,
				limit: rowLimit > 0 ? rowLimit : undefined,
				tier: userTier,
				cached: true,
				cache_timestamp: new Date(catalogApiCache.timestamp).toISOString(),
				api_version: '1.0'
			});

			// Add rate limit headers
			response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
			response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
			response.headers.set(
				'X-RateLimit-Reset',
				Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString()
			);

			return response;
		}

		console.log('Fetching catalog API data from database');

		// Fetch only public coffees with specified columns
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: rows, error: dbError } = await (supabase as any)
			.from('coffee_catalog')
			.select(CATALOG_API_COLUMNS)
			.eq('public_coffee', true)
			.order('name');

		if (dbError) {
			console.error('Database error:', dbError);

			// Log database error
			await logApiUsage(
				apiKeyId,
				'/api/catalog-api',
				500,
				Date.now() - startTime,
				request.headers.get('User-Agent') || undefined,
				request.headers.get('X-Forwarded-For') || undefined
			);

			throw dbError;
		}

		// Update cache
		catalogApiCache = {
			data: rows || [],
			timestamp: now
		};

		// Apply row limiting for free tier
		let responseData = rows || [];
		let isLimited = false;
		if (rowLimit > 0 && responseData.length > rowLimit) {
			responseData = responseData.slice(0, rowLimit);
			isLimited = true;
		}

		// Log successful request
		await logApiUsage(
			apiKeyId,
			'/api/catalog-api',
			200,
			Date.now() - startTime,
			request.headers.get('User-Agent') || undefined,
			request.headers.get('X-Forwarded-For') || undefined
		);

		// Return API response with metadata and rate limit headers
		const response = json({
			data: responseData,
			total: responseData?.length || 0,
			total_available: rows?.length || 0,
			limited: isLimited,
			limit: rowLimit > 0 ? rowLimit : undefined,
			tier: userTier,
			cached: false,
			last_updated: new Date().toISOString(),
			api_version: '1.0'
		});

		// Add rate limit headers
		response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
		response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
		response.headers.set(
			'X-RateLimit-Reset',
			Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString()
		);

		return response;
	} catch (error) {
		console.error('Error querying catalog API:', error);

		// Log error if we have apiKeyId
		if (apiKeyId) {
			await logApiUsage(
				apiKeyId,
				'/api/catalog-api',
				500,
				Date.now() - startTime,
				request.headers.get('User-Agent') || undefined,
				request.headers.get('X-Forwarded-For') || undefined
			);
		}

		return json(
			{
				error: 'Failed to fetch catalog data',
				message: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
