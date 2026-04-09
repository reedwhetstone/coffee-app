import type { RequestEvent } from '@sveltejs/kit';
import {
	getCatalogDropdown,
	searchCatalog,
	type CatalogDropdownItem,
	type CatalogItem
} from '$lib/data/catalog';
import {
	checkRateLimit,
	getApiRowLimit,
	logApiUsage,
	type ApiPlan,
	type RateLimitResult
} from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import {
	isApiKeyPrincipal,
	isSessionPrincipal,
	resolvePrincipal,
	type RequestPrincipal
} from '$lib/server/principal';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import { jsonResponse } from '$lib/server/http';
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
		stocked?: boolean | null; // true = stocked only (default), false = unstocked only, null = all
		origin?: string; // cross-field partial match: continent, country, region
		continent?: string;
		country?: string | string[];
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
		pricePerLbMin?: number;
		pricePerLbMax?: number;
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

interface QueryCatalogDataOptions {
	forceDefaultPagination?: boolean;
}

const DEFAULT_API_PAGE_LIMIT = 100;

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

function parseOptionalNumberFromAliases(url: URL, ...paramNames: string[]): number | undefined {
	for (const paramName of paramNames) {
		const value = parseOptionalNumber(url.searchParams.get(paramName));
		if (value !== undefined) return value;
	}

	return undefined;
}

function parseCatalogQuery(url: URL): ParsedCatalogQuery {
	const page = parsePositiveInteger(url.searchParams.get('page'), 1);
	const limit = parsePositiveInteger(url.searchParams.get('limit'), 15);
	const ids = url.searchParams
		.getAll('ids')
		.map((value) => Number.parseInt(value, 10))
		.filter((value) => Number.isFinite(value));

	// Parse stocked param: true (default, no param) | false (unstocked only) | null (all)
	const stockedParam = url.searchParams.get('stocked');
	const stockedFilter: boolean | null =
		stockedParam === 'false' ? false : stockedParam === 'all' ? null : true;

	const countryParams = url.searchParams.getAll('country').filter(Boolean);
	const countryFilter =
		countryParams.length > 1
			? countryParams
			: (countryParams[0] ?? url.searchParams.get('country') ?? undefined);

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
			stocked: stockedFilter,
			origin: url.searchParams.get('origin') ?? undefined,
			continent: url.searchParams.get('continent') ?? undefined,
			country: countryFilter,
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
			// cost_lb_* remains as a deprecated compatibility alias. The actual filter
			// source of truth is price_per_lb, so prefer the canonical params when present.
			pricePerLbMin: parseOptionalNumberFromAliases(url, 'price_per_lb_min', 'cost_lb_min'),
			pricePerLbMax: parseOptionalNumberFromAliases(url, 'price_per_lb_max', 'cost_lb_max'),
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
		const rateLimit = await checkRateLimit(apiPrincipal.apiKeyId, apiPrincipal.apiPlan);

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

	const visibility = resolveCatalogVisibility({
		session: isSessionPrincipal(principal) ? principal.session : null,
		role: principal.primaryAppRole,
		showWholesaleRequested: query.showWholesale,
		wholesaleOnlyRequested: query.wholesaleOnly
	});

	return {
		principal,
		authKind: isSessionPrincipal(principal) ? 'session' : 'anonymous',
		role: principal.primaryAppRole,
		apiPlan: principal.apiPlan,
		publicOnly: visibility.publicOnly,
		showWholesale: visibility.showWholesale,
		wholesaleOnly: visibility.wholesaleOnly,
		rowLimit: null,
		rateLimitHeaders: null,
		apiKeyId: null,
		requestPath,
		supabase: event.locals.supabase
	};
}

async function queryCatalogData(
	context: CatalogAccessContext,
	query: ParsedCatalogQuery,
	options: QueryCatalogDataOptions = {}
): Promise<CanonicalCatalogResponse> {
	// Preserve the existing specialized contracts for explicit ID fetches and
	// dropdown projection requests. Default pagination is only for the standard
	// canonical listing response when callers omit both page and limit.
	const useDefaultPagination =
		options.forceDefaultPagination === true &&
		!query.isPaginated &&
		query.ids.length === 0 &&
		query.fields !== 'dropdown';
	const requestedPage = query.isPaginated ? query.page : 1;
	const requestedLimit = query.isPaginated
		? query.limit
		: useDefaultPagination
			? DEFAULT_API_PAGE_LIMIT
			: query.limit;
	const requestedOffset = query.isPaginated ? query.offset : 0;
	const useRowLimitedPagination =
		!query.isPaginated && !useDefaultPagination && context.rowLimit !== null;
	const isPaginated = query.isPaginated || useDefaultPagination || useRowLimitedPagination;
	const effectiveLimit = context.rowLimit
		? isPaginated
			? Math.min(requestedLimit, context.rowLimit)
			: context.rowLimit
		: requestedLimit;
	const page = isPaginated ? requestedPage : 1;
	const offset = isPaginated ? requestedOffset : 0;

	// stocked filter: true = stocked only (default), false = unstocked only, null = all items
	// parseCatalogQuery always assigns this; no param defaults to true.
	const stockedFilter: boolean | null =
		query.filters.stocked !== undefined ? query.filters.stocked : true;

	if (query.fields === 'dropdown' && query.ids.length === 0 && !isPaginated) {
		// getCatalogDropdown now supports stockedFilter directly (3-way: true/false/null)
		const rows = await getCatalogDropdown(context.supabase, {
			stockedFilter,
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
		stockedFilter,
		publicOnly: context.publicOnly,
		showWholesale: context.showWholesale,
		wholesaleOnly: context.wholesaleOnly,
		coffeeIds: query.ids.length > 0 ? query.ids : undefined,
		origin: query.filters.origin,
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
		pricePerLbMin: query.filters.pricePerLbMin,
		pricePerLbMax: query.filters.pricePerLbMax,
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
				limited: context.rowLimit !== null && totalAvailable > context.rowLimit,
				totalAvailable
			},
			cache: {
				hit: false,
				timestamp: null
			}
		}
	};
}

// Share the resolved catalog payload across route adapters so legacy shims do not
// pay an extra parse/stringify pass on large unpaginated responses.
async function resolveCatalogRouteResult(
	event: RequestEvent,
	options: { requestPath?: string; forceDefaultPagination?: boolean } = {}
): Promise<{
	status: number;
	body: CanonicalCatalogResponse | Record<string, unknown>;
	headers: Headers;
}> {
	const requestPath = options.requestPath ?? event.url.pathname;
	const startTime = Date.now();
	const query = parseCatalogQuery(event.url);
	let context: CatalogAccessContext | null = null;

	try {
		context = await resolveCatalogAccessContext(event, query, requestPath);
		const body = await queryCatalogData(context, query, {
			forceDefaultPagination: options.forceDefaultPagination
		});
		await logCatalogApiUsage(context, event, 200, startTime);

		const headers = new Headers();
		if (context.rateLimitHeaders) {
			for (const [name, value] of context.rateLimitHeaders.entries()) {
				headers.set(name, value);
			}
		}

		return {
			status: 200,
			body,
			headers
		};
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

			return {
				status: 429,
				body: {
					error: 'Rate limit exceeded',
					message: error.message,
					limit: error.result.limit,
					remaining: error.result.remaining,
					resetTime: error.result.resetTime
				},
				headers: new Headers({
					'X-RateLimit-Limit': error.result.limit.toString(),
					'X-RateLimit-Remaining': error.result.remaining.toString(),
					'X-RateLimit-Reset': Math.floor(error.result.resetTime.getTime() / 1000).toString(),
					'Retry-After': error.result.retryAfter?.toString() || '3600'
				})
			};
		}

		if (error instanceof AuthError) {
			if (context) {
				await logCatalogApiUsage(context, event, error.status, startTime);
			}

			return {
				status: error.status,
				body: {
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				headers: new Headers()
			};
		}

		const safeError = error instanceof Error ? error.message : String(error);
		console.error('Error querying canonical catalog:', safeError);
		if (context) {
			await logCatalogApiUsage(context, event, 500, startTime);
		}
		return {
			status: 500,
			body: { error: 'Failed to fetch catalog data', message: 'Internal server error' },
			headers: new Headers()
		};
	}
}

export async function buildCanonicalCatalogResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const result = await resolveCatalogRouteResult(event, {
		...options,
		forceDefaultPagination: true
	});
	return jsonResponse(result.body, {
		status: result.status,
		headers: result.headers
	});
}

export async function buildLegacyAppCatalogResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const result = await resolveCatalogRouteResult(event, {
		...options,
		forceDefaultPagination: false
	});

	if (result.status >= 400) {
		return jsonResponse(result.body, {
			status: result.status,
			headers: result.headers
		});
	}

	const body = result.body as CanonicalCatalogResponse;
	const hasPagination = body.pagination !== null;
	const legacyBody = hasPagination ? { data: body.data, pagination: body.pagination } : body.data;
	const headers = new Headers(result.headers);
	headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');

	return jsonResponse(legacyBody, {
		status: result.status,
		headers
	});
}
