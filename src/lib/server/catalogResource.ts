import { json, type RequestEvent } from '@sveltejs/kit';
import {
	getCatalogDropdown,
	searchCatalog,
	type CatalogDropdownItem,
	type CatalogItem
} from '$lib/data/catalog';
import {
	checkRateLimit,
	getApiRowLimit,
	getLegacyRateLimitTier,
	logApiUsage,
	type ApiPlan,
	type RateLimitResult
} from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import {
	isApiKeyPrincipal,
	isSessionPrincipal,
	principalHasRole,
	resolvePrincipal,
	type RequestPrincipal
} from '$lib/server/principal';
import { createAdminClient } from '$lib/supabase-admin';
import type { UserRole } from '$lib/types/auth.types';

export type CatalogResourceItem = Omit<CatalogItem, 'coffee_user'>;
export type CatalogResponseItem = CatalogResourceItem | CatalogDropdownItem;
export type CatalogAuthKind = 'anonymous' | 'session' | 'api-key';

export interface CatalogPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface CanonicalCatalogResponse<T extends CatalogResponseItem = CatalogResponseItem> {
	data: T[];
	pagination: CatalogPagination | null;
	meta: {
		resource: 'catalog';
		namespace: '/v1/catalog';
		version: 'v1';
		auth: {
			kind: CatalogAuthKind;
			role: UserRole | null;
			apiPlan: ApiPlan | null;
		};
		access: {
			publicOnly: boolean;
			showWholesale: boolean;
			wholesaleOnly: boolean;
			rowLimit: number | null;
			limited: boolean;
			totalAvailable: number;
		};
		cache: {
			hit: boolean;
			timestamp: string | null;
		};
	};
}

interface ParsedCatalogQuery {
	ids: number[];
	fields: 'full' | 'dropdown';
	page: number;
	limit: number;
	offset: number;
	isPaginated: boolean;
	sortField?: string;
	sortDirection?: 'asc' | 'desc';
	showWholesale: boolean;
	wholesaleOnly: boolean;
	filters: {
		continent?: string;
		country?: string;
		source?: string[];
		processing?: string;
		cultivarDetail?: string;
		type?: string;
		grade?: string;
		appearance?: string;
		name?: string;
		region?: string;
		scoreValueMin?: number;
		scoreValueMax?: number;
		costLbMin?: number;
		costLbMax?: number;
		arrivalDate?: string;
		stockedDate?: string;
	};
}

interface CatalogAccessContext {
	principal: RequestPrincipal;
	authKind: CatalogAuthKind;
	role: UserRole | null;
	apiPlan: ApiPlan | null;
	publicOnly: boolean;
	showWholesale: boolean;
	wholesaleOnly: boolean;
	rowLimit: number | null;
	rateLimitHeaders: Headers | null;
	apiKeyId: string | null;
	requestPath: string;
	supabase: RequestEvent['locals']['supabase'];
}

class CatalogRateLimitError extends Error {
	constructor(
		public apiKeyId: string,
		public requestPath: string,
		public result: RateLimitResult
	) {
		super('API rate limit exceeded for your subscription plan');
		this.name = 'CatalogRateLimitError';
	}
}

function parsePositiveInteger(value: string | null, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function toCatalogResourceItem(item: CatalogItem): CatalogResourceItem {
	const { coffee_user: _coffeeUser, ...resourceItem } = item;
	return resourceItem;
}

function parseCatalogQuery(url: URL): ParsedCatalogQuery {
	const page = parsePositiveInteger(url.searchParams.get('page'), 1);
	const limit = parsePositiveInteger(url.searchParams.get('limit'), 15);
	const ids = url.searchParams
		.getAll('ids')
		.map((value) => Number.parseInt(value, 10))
		.filter((value) => Number.isFinite(value));

	return {
		ids,
		fields: url.searchParams.get('fields') === 'dropdown' ? 'dropdown' : 'full',
		page,
		limit,
		offset: (page - 1) * limit,
		isPaginated: url.searchParams.has('page') || url.searchParams.has('limit'),
		sortField: url.searchParams.get('sortField') ?? undefined,
		sortDirection:
			url.searchParams.get('sortDirection') === 'asc' ||
			url.searchParams.get('sortDirection') === 'desc'
				? (url.searchParams.get('sortDirection') as 'asc' | 'desc')
				: undefined,
		showWholesale: url.searchParams.get('showWholesale') === 'true',
		wholesaleOnly: url.searchParams.get('wholesaleOnly') === 'true',
		filters: {
			continent: url.searchParams.get('continent') ?? undefined,
			country: url.searchParams.get('country') ?? undefined,
			source: url.searchParams.getAll('source'),
			processing: url.searchParams.get('processing') ?? undefined,
			cultivarDetail: url.searchParams.get('cultivar_detail') ?? undefined,
			type: url.searchParams.get('type') ?? undefined,
			grade: url.searchParams.get('grade') ?? undefined,
			appearance: url.searchParams.get('appearance') ?? undefined,
			name: url.searchParams.get('name') ?? undefined,
			region: url.searchParams.get('region') ?? undefined,
			scoreValueMin: parseOptionalNumber(url.searchParams.get('score_value_min')),
			scoreValueMax: parseOptionalNumber(url.searchParams.get('score_value_max')),
			costLbMin: parseOptionalNumber(url.searchParams.get('cost_lb_min')),
			costLbMax: parseOptionalNumber(url.searchParams.get('cost_lb_max')),
			arrivalDate: url.searchParams.get('arrival_date') ?? undefined,
			stockedDate: url.searchParams.get('stocked_date') ?? undefined
		}
	};
}

async function logCatalogApiUsage(
	context: CatalogAccessContext,
	event: RequestEvent,
	statusCode: number,
	startTime: number
) {
	if (!context.apiKeyId) {
		return;
	}

	await logApiUsage(
		context.apiKeyId,
		context.requestPath,
		statusCode,
		Date.now() - startTime,
		event.request.headers.get('User-Agent') || undefined,
		event.request.headers.get('X-Forwarded-For') || undefined
	);
}

async function resolveCatalogAccessContext(
	event: RequestEvent,
	query: ParsedCatalogQuery,
	requestPath: string
): Promise<CatalogAccessContext> {
	const principal = await resolvePrincipal(event);
	const hasAuthorizationHeader = event.request.headers.has('Authorization');

	if (hasAuthorizationHeader && !principal.isAuthenticated) {
		throw new AuthError('Authentication required');
	}

	if (isApiKeyPrincipal(principal)) {
		const apiPrincipal = await requireApiKeyAccess(event, {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		const rowLimit = getApiRowLimit(apiPrincipal.apiPlan);
		const rateLimit = await checkRateLimit(
			apiPrincipal.apiKeyId,
			getLegacyRateLimitTier(apiPrincipal.apiPlan)
		);

		if (!rateLimit.allowed) {
			throw new CatalogRateLimitError(apiPrincipal.apiKeyId, requestPath, rateLimit);
		}

		const headers = new Headers({
			'X-RateLimit-Limit': rateLimit.limit.toString(),
			'X-RateLimit-Remaining': rateLimit.remaining.toString(),
			'X-RateLimit-Reset': Math.floor(rateLimit.resetTime.getTime() / 1000).toString()
		});

		return {
			principal: apiPrincipal,
			authKind: 'api-key',
			role: apiPrincipal.primaryAppRole,
			apiPlan: apiPrincipal.apiPlan,
			publicOnly: true,
			showWholesale: false,
			wholesaleOnly: false,
			rowLimit: rowLimit > 0 ? rowLimit : null,
			rateLimitHeaders: headers,
			apiKeyId: apiPrincipal.apiKeyId,
			requestPath,
			supabase: createAdminClient() as unknown as RequestEvent['locals']['supabase']
		};
	}

	const isPrivilegedSession =
		isSessionPrincipal(principal) && principalHasRole(principal, 'member');

	return {
		principal,
		authKind: isSessionPrincipal(principal) ? 'session' : 'anonymous',
		role: principal.primaryAppRole,
		apiPlan: principal.apiPlan,
		publicOnly: !isPrivilegedSession,
		showWholesale: isPrivilegedSession && query.showWholesale,
		wholesaleOnly: isPrivilegedSession && query.wholesaleOnly,
		rowLimit: null,
		rateLimitHeaders: null,
		apiKeyId: null,
		requestPath,
		supabase: event.locals.supabase
	};
}

async function queryCatalogData(
	context: CatalogAccessContext,
	query: ParsedCatalogQuery
): Promise<CanonicalCatalogResponse> {
	const effectiveLimit = context.rowLimit
		? query.isPaginated
			? Math.min(query.limit, context.rowLimit)
			: context.rowLimit
		: query.limit;
	const useRowLimitedPagination = !query.isPaginated && context.rowLimit !== null;
	const isPaginated = query.isPaginated || useRowLimitedPagination;
	const page = query.isPaginated ? query.page : 1;
	const offset = query.isPaginated ? query.offset : 0;

	if (query.fields === 'dropdown' && query.ids.length === 0 && !isPaginated) {
		const rows = await getCatalogDropdown(context.supabase, {
			stockedOnly: true,
			publicOnly: context.publicOnly,
			showWholesale: context.showWholesale,
			wholesaleOnly: context.wholesaleOnly
		});

		const totalAvailable = rows.length;
		const data = context.rowLimit ? rows.slice(0, context.rowLimit) : rows;

		return {
			data,
			pagination: null,
			meta: {
				resource: 'catalog',
				namespace: '/v1/catalog',
				version: 'v1',
				auth: {
					kind: context.authKind,
					role: context.role,
					apiPlan: context.apiPlan
				},
				access: {
					publicOnly: context.publicOnly,
					showWholesale: context.showWholesale,
					wholesaleOnly: context.wholesaleOnly,
					rowLimit: context.rowLimit,
					limited: context.rowLimit !== null && totalAvailable > data.length,
					totalAvailable
				},
				cache: {
					hit: false,
					timestamp: null
				}
			}
		};
	}

	const result = await searchCatalog(context.supabase, {
		stockedOnly: true,
		publicOnly: context.publicOnly,
		showWholesale: context.showWholesale,
		wholesaleOnly: context.wholesaleOnly,
		coffeeIds: query.ids.length > 0 ? query.ids : undefined,
		continent: query.filters.continent,
		country: query.filters.country,
		source:
			query.filters.source && query.filters.source.length > 0 ? query.filters.source : undefined,
		processing: query.filters.processing,
		cultivarDetail: query.filters.cultivarDetail,
		type: query.filters.type,
		grade: query.filters.grade,
		appearance: query.filters.appearance,
		name: query.filters.name,
		region: query.filters.region,
		scoreValueMin: query.filters.scoreValueMin,
		scoreValueMax: query.filters.scoreValueMax,
		costLbMin: query.filters.costLbMin,
		costLbMax: query.filters.costLbMax,
		arrivalDate: query.filters.arrivalDate,
		stockedDate: query.filters.stockedDate,
		orderBy: query.ids.length > 0 ? 'name' : query.sortField || 'arrival_date',
		orderDirection: query.sortDirection || (query.ids.length > 0 ? 'asc' : 'desc'),
		limit: isPaginated ? effectiveLimit : undefined,
		offset: isPaginated ? offset : undefined
	});

	const totalAvailable = result.count || result.data.length;
	const fullRows = result.data.map(toCatalogResourceItem);
	const data = !isPaginated && context.rowLimit ? fullRows.slice(0, context.rowLimit) : fullRows;
	const totalPages = isPaginated ? Math.ceil(totalAvailable / effectiveLimit) : 0;

	return {
		data,
		pagination: isPaginated
			? {
					page,
					limit: effectiveLimit,
					total: totalAvailable,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			: null,
		meta: {
			resource: 'catalog',
			namespace: '/v1/catalog',
			version: 'v1',
			auth: {
				kind: context.authKind,
				role: context.role,
				apiPlan: context.apiPlan
			},
			access: {
				publicOnly: context.publicOnly,
				showWholesale: context.showWholesale,
				wholesaleOnly: context.wholesaleOnly,
				rowLimit: context.rowLimit,
				limited: data.length < totalAvailable,
				totalAvailable
			},
			cache: {
				hit: false,
				timestamp: null
			}
		}
	};
}

export async function buildCanonicalCatalogResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	const startTime = Date.now();
	const query = parseCatalogQuery(event.url);
	let context: CatalogAccessContext | null = null;

	try {
		context = await resolveCatalogAccessContext(event, query, requestPath);
		const body = await queryCatalogData(context, query);
		await logCatalogApiUsage(context, event, 200, startTime);

		const response = json(body);
		if (context.rateLimitHeaders) {
			for (const [name, value] of context.rateLimitHeaders.entries()) {
				response.headers.set(name, value);
			}
		}
		return response;
	} catch (error) {
		if (error instanceof CatalogRateLimitError) {
			await logApiUsage(
				error.apiKeyId,
				error.requestPath,
				429,
				Date.now() - startTime,
				event.request.headers.get('User-Agent') || undefined,
				event.request.headers.get('X-Forwarded-For') || undefined
			);

			return json(
				{
					error: 'Rate limit exceeded',
					message: error.message,
					limit: error.result.limit,
					remaining: error.result.remaining,
					resetTime: error.result.resetTime
				},
				{
					status: 429,
					headers: {
						'X-RateLimit-Limit': error.result.limit.toString(),
						'X-RateLimit-Remaining': error.result.remaining.toString(),
						'X-RateLimit-Reset': Math.floor(error.result.resetTime.getTime() / 1000).toString(),
						'Retry-After': error.result.retryAfter?.toString() || '3600'
					}
				}
			);
		}

		if (error instanceof AuthError) {
			if (context) {
				await logCatalogApiUsage(context, event, error.status, startTime);
			}

			return json(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{ status: error.status }
			);
		}

		console.error('Error querying canonical catalog:', error);
		if (context) {
			await logCatalogApiUsage(context, event, 500, startTime);
		}
		return json(
			{ error: 'Failed to fetch catalog data', message: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function buildLegacyAppCatalogResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const canonicalResponse = await buildCanonicalCatalogResponse(event, {
		requestPath: options.requestPath
	});
	const body = await canonicalResponse.json();

	if (!canonicalResponse.ok) {
		return json(body, {
			status: canonicalResponse.status,
			headers: Object.fromEntries(canonicalResponse.headers.entries())
		});
	}

	const hasPagination = body.pagination !== null;
	const legacyBody = hasPagination ? { data: body.data, pagination: body.pagination } : body.data;
	const response = json(legacyBody, {
		status: canonicalResponse.status
	});

	for (const [name, value] of canonicalResponse.headers.entries()) {
		response.headers.set(name, value);
	}

	response.headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');
	return response;
}

export async function buildLegacyExternalCatalogResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const canonicalResponse = await buildCanonicalCatalogResponse(event, {
		requestPath: options.requestPath
	});
	const body = await canonicalResponse.json();

	if (!canonicalResponse.ok) {
		return json(body, {
			status: canonicalResponse.status,
			headers: Object.fromEntries(canonicalResponse.headers.entries())
		});
	}

	const cacheTimestamp = body.meta.cache.timestamp;
	const response = json(
		{
			data: body.data,
			total: body.data.length,
			total_available: body.meta.access.totalAvailable,
			limited: body.meta.access.limited,
			limit: body.meta.access.rowLimit ?? undefined,
			tier: body.meta.auth.apiPlan,
			cached: body.meta.cache.hit,
			cache_timestamp: cacheTimestamp ?? undefined,
			last_updated: cacheTimestamp ?? new Date().toISOString(),
			api_version: '1.0'
		},
		{
			status: canonicalResponse.status
		}
	);

	for (const [name, value] of canonicalResponse.headers.entries()) {
		response.headers.set(name, value);
	}

	response.headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');
	return response;
}
