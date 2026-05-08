import type { RequestHandler } from './$types';
import { checkRateLimit, logApiUsage, type RateLimitResult } from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { resolveCatalogAccessCapabilities } from '$lib/server/catalogAccess';
import {
	CatalogSimilarityNotFoundError,
	CatalogSimilarityValidationError,
	fetchCatalogSimilarityMatches,
	parseCatalogSimilarityQuery,
	type CatalogSimilarityResponse
} from '$lib/server/catalogSimilarity';
import { jsonResponse } from '$lib/server/http';
import { isApiKeyPrincipal, resolvePrincipal, type RequestPrincipal } from '$lib/server/principal';
import { createAdminClient } from '$lib/supabase-admin';

const REQUEST_PATH = '/v1/catalog/{id}/similar';
const POSTGRES_INT4_MAX = 2_147_483_647;
const POSTGRES_INT4_MAX_STRING = String(POSTGRES_INT4_MAX);
const CATALOG_ID_EXPECTED_FORMAT = `positive integer less than or equal to ${POSTGRES_INT4_MAX}`;

class CatalogSimilarRateLimitError extends Error {
	constructor(
		public apiKeyId: string,
		public result: RateLimitResult
	) {
		super('API rate limit exceeded for your subscription plan');
		this.name = 'CatalogSimilarRateLimitError';
	}
}

function parseCoffeeId(rawId: string | undefined): number {
	if (!rawId || !/^\d+$/.test(rawId)) {
		throw new CatalogSimilarityValidationError('id', rawId ?? '', 'positive integer');
	}
	const normalizedId = rawId.replace(/^0+/, '') || '0';
	if (normalizedId === '0') {
		throw new CatalogSimilarityValidationError('id', rawId, 'positive integer');
	}
	if (
		normalizedId.length > POSTGRES_INT4_MAX_STRING.length ||
		(normalizedId.length === POSTGRES_INT4_MAX_STRING.length &&
			normalizedId > POSTGRES_INT4_MAX_STRING)
	) {
		throw new CatalogSimilarityValidationError('id', rawId, CATALOG_ID_EXPECTED_FORMAT);
	}
	const coffeeId = Number.parseInt(normalizedId, 10);
	if (!Number.isSafeInteger(coffeeId)) {
		throw new CatalogSimilarityValidationError('id', rawId, 'positive integer');
	}
	return coffeeId;
}

async function logSimilarApiUsage(input: {
	principal: RequestPrincipal | null;
	statusCode: number;
	startTime: number;
	event: Parameters<RequestHandler>[0];
}) {
	if (!input.principal || !isApiKeyPrincipal(input.principal)) return;

	await logApiUsage(
		input.principal.apiKeyId,
		REQUEST_PATH,
		input.statusCode,
		Date.now() - input.startTime,
		input.event.request.headers.get('User-Agent') || undefined,
		input.event.request.headers.get('X-Forwarded-For') || undefined
	);
}

function rateLimitHeaders(result: RateLimitResult): Headers {
	return new Headers({
		'X-RateLimit-Limit': result.limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString()
	});
}

export const GET: RequestHandler = async (event) => {
	const startTime = Date.now();
	let principal: RequestPrincipal | null = null;

	try {
		const coffeeId = parseCoffeeId(event.params.id);
		const query = parseCatalogSimilarityQuery(event.url);
		principal = await resolvePrincipal(event);

		if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
			throw new AuthError('Authentication required');
		}

		const capabilities = resolveCatalogAccessCapabilities({ principal });

		if (!principal.isAuthenticated) {
			return jsonResponse(
				{
					error: 'Authentication required',
					message: 'Similar coffee matching requires a member account or paid API tier.',
					code: 'auth_required',
					requiredCapability: 'canUseBeanMatching'
				},
				{ status: 401 }
			);
		}

		if (!capabilities.canUseBeanMatching) {
			await logSimilarApiUsage({ principal, statusCode: 403, startTime, event });

			return jsonResponse(
				{
					error: 'Insufficient permissions',
					message: 'Similar coffee matching is available to members and paid API tiers.',
					code: 'entitlement_required',
					requiredCapability: 'canUseBeanMatching',
					teaser: {
						locked: true,
						similar_match_count: null,
						beta: true
					}
				},
				{ status: 403 }
			);
		}

		const adminSupabase = createAdminClient();

		let headers = new Headers();
		if (isApiKeyPrincipal(principal)) {
			const apiPrincipal = await requireApiKeyAccess(event, {
				requiredPlan: 'member',
				requiredScope: 'catalog:read'
			});
			principal = apiPrincipal;

			const rateLimit = await checkRateLimit(apiPrincipal.apiKeyId, apiPrincipal.apiPlan);
			if (!rateLimit.allowed) {
				throw new CatalogSimilarRateLimitError(apiPrincipal.apiKeyId, rateLimit);
			}
			headers = rateLimitHeaders(rateLimit);
		}

		const result = await fetchCatalogSimilarityMatches({
			supabase: adminSupabase,
			coffeeId,
			query
		});
		const { queryStrategy, ...data } = result;

		const body: CatalogSimilarityResponse = {
			data,
			meta: {
				resource: 'catalog-similarity',
				namespace: REQUEST_PATH,
				version: 'v1',
				status: 'beta',
				auth: {
					kind: isApiKeyPrincipal(principal) ? 'api-key' : 'session',
					role: principal.primaryAppRole,
					apiPlan: principal.apiPlan
				},
				access: {
					requiredCapability: 'canUseBeanMatching',
					canUseBeanMatching: true
				},
				query,
				copy: {
					confidence:
						'Matches are beta confidence candidates based on similarity signals and deterministic identity gates. Canonical candidates are not accepted identities; similar recommendations are not same-coffee claims.'
				},
				classification_version: 'canonical-match-v1',
				query_strategy: queryStrategy
			}
		};

		await logSimilarApiUsage({ principal, statusCode: 200, startTime, event });
		return jsonResponse(body, { status: 200, headers });
	} catch (error) {
		if (error instanceof CatalogSimilarRateLimitError) {
			await logApiUsage(
				error.apiKeyId,
				REQUEST_PATH,
				429,
				Date.now() - startTime,
				event.request.headers.get('User-Agent') || undefined,
				event.request.headers.get('X-Forwarded-For') || undefined
			);

			const headers = rateLimitHeaders(error.result);
			headers.set('Retry-After', error.result.retryAfter?.toString() || '3600');
			return jsonResponse(
				{
					error: 'Rate limit exceeded',
					message: error.message,
					limit: error.result.limit,
					remaining: error.result.remaining,
					resetTime: error.result.resetTime
				},
				{ status: 429, headers }
			);
		}

		if (error instanceof AuthError) {
			await logSimilarApiUsage({ principal, statusCode: error.status, startTime, event });
			return jsonResponse(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message,
					requiredCapability: 'canUseBeanMatching'
				},
				{ status: error.status }
			);
		}

		if (error instanceof CatalogSimilarityValidationError) {
			await logSimilarApiUsage({ principal, statusCode: 400, startTime, event });
			return jsonResponse(
				{
					error: 'Invalid query parameter',
					message: error.message,
					details: {
						parameter: error.parameter,
						value: error.value,
						expected: error.expected
					}
				},
				{ status: 400 }
			);
		}

		if (error instanceof CatalogSimilarityNotFoundError) {
			await logSimilarApiUsage({ principal, statusCode: 404, startTime, event });
			return jsonResponse(
				{
					error: 'Catalog coffee not found',
					message: error.message
				},
				{ status: 404 }
			);
		}

		const safeError = error instanceof Error ? error.message : String(error);
		console.error('Error querying catalog similarity:', safeError);
		await logSimilarApiUsage({ principal, statusCode: 500, startTime, event });
		return jsonResponse(
			{ error: 'Failed to fetch similar coffees', message: 'Internal server error' },
			{ status: 500 }
		);
	}
};
