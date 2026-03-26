import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	checkRateLimit,
	getApiRowLimit,
	getLegacyRateLimitTier,
	logApiUsage
} from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { createAdminClient } from '$lib/supabase-admin';
import { getPublicCatalog, CATALOG_API_COLUMNS } from '$lib/data/catalog';

// Cache for catalog API data
let catalogApiCache: {
	data: Record<string, unknown>[] | null;
	timestamp: number;
} = {
	data: null,
	timestamp: 0
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export const GET: RequestHandler = async (event) => {
	const { request } = event;
	const startTime = Date.now();
	let apiKeyId: string | undefined;

	try {
		const principal = await requireApiKeyAccess(event, {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		apiKeyId = principal.apiKeyId;

		const userTier = principal.apiPlan;
		const rowLimit = getApiRowLimit(userTier);
		const rateLimitResult = await checkRateLimit(apiKeyId, getLegacyRateLimitTier(userTier));

		if (!rateLimitResult.allowed) {
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
		const supabase = createAdminClient();

		// Fetch only public coffees with specified columns
		const rows = await getPublicCatalog(supabase, CATALOG_API_COLUMNS);

		// Update cache
		catalogApiCache = {
			data: rows,
			timestamp: now
		};

		// Apply row limiting for free tier
		let responseData = rows;
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

		response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
		response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
		response.headers.set(
			'X-RateLimit-Reset',
			Math.floor(rateLimitResult.resetTime.getTime() / 1000).toString()
		);

		return response;
	} catch (error) {
		if (error instanceof AuthError) {
			if (apiKeyId) {
				await logApiUsage(
					apiKeyId,
					'/api/catalog-api',
					error.status,
					Date.now() - startTime,
					request.headers.get('User-Agent') || undefined,
					request.headers.get('X-Forwarded-For') || undefined
				);
			}

			return json(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{ status: error.status }
			);
		}

		console.error('Error querying catalog API:', error);

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
