import type { RequestEvent } from '@sveltejs/kit';
import {
	getCatalogDropdown,
	searchCatalog,
	searchCatalogDropdown,
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
import { DEFAULT_CATALOG_LISTING_LIMIT, MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';

export interface CatalogProcessSummary {
	base_method: string | null;
	fermentation_type: string | null;
	additives: string[] | null;
	additive_detail: string | null;
	fermentation_duration_hours: number | null;
	drying_method: string | null;
	notes: string | null;
	disclosure_level: string | null;
	confidence: number | null;
	evidence_available: boolean;
}

type CatalogResourceQueryItem = Omit<CatalogItem, 'coffee_user' | 'processing_evidence'> & {
	coffee_user?: CatalogItem['coffee_user'];
	processing_evidence?: CatalogItem['processing_evidence'];
	processing_evidence_schema_version?: string | number | null;
};

export type CatalogResourceItem = Omit<CatalogItem, 'coffee_user' | 'processing_evidence'> & {
	process: CatalogProcessSummary;
};
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
		processingBaseMethod?: string;
		fermentationType?: string;
		processAdditive?: string;
		hasAdditives?: boolean;
		processingDisclosureLevel?: string;
		processingConfidenceMin?: number;
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
		stockedDays?: number;
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

const ISO_DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

class CatalogQueryValidationError extends Error {
	constructor(
		public parameter: string,
		public value: string,
		public expected: string
	) {
		super(`Query parameter "${parameter}" must use ${expected} format`);
		this.name = 'CatalogQueryValidationError';
	}
}

function parsePositiveInteger(value: string | null, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRequiredPositiveInteger(value: string, parameter: string): number {
	if (!/^\d+$/.test(value)) {
		throw new CatalogQueryValidationError(parameter, value, 'positive integer');
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new CatalogQueryValidationError(parameter, value, 'positive integer');
	}

	return parsed;
}

function parseRequiredNumber(value: string, parameter: string): number {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new CatalogQueryValidationError(parameter, value, 'number');
	}

	const numericPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
	if (!numericPattern.test(trimmed)) {
		throw new CatalogQueryValidationError(parameter, value, 'number');
	}

	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed)) {
		throw new CatalogQueryValidationError(parameter, value, 'number');
	}

	return parsed;
}

function isIsoDateParam(value: string): boolean {
	if (!ISO_DATE_PARAM_PATTERN.test(value)) return false;

	const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
	const parsedDate = new Date(Date.UTC(year, month - 1, day));

	return (
		parsedDate.getUTCFullYear() === year &&
		parsedDate.getUTCMonth() === month - 1 &&
		parsedDate.getUTCDate() === day
	);
}

function validateCatalogQuery(url: URL): void {
	const stockedDate = url.searchParams.get('stocked_date');
	if (stockedDate !== null && !isIsoDateParam(stockedDate)) {
		throw new CatalogQueryValidationError('stocked_date', stockedDate, 'YYYY-MM-DD');
	}

	const limit = url.searchParams.get('limit');
	if (limit !== null) {
		const parsedLimit = parseRequiredPositiveInteger(limit, 'limit');
		if (parsedLimit > MAX_CATALOG_PAGE_LIMIT) {
			throw new CatalogQueryValidationError(
				'limit',
				limit,
				`positive integer less than or equal to ${MAX_CATALOG_PAGE_LIMIT}`
			);
		}
	}

	const positiveIntegerParams = ['page', 'stocked_days'];
	for (const parameter of positiveIntegerParams) {
		const value = url.searchParams.get(parameter);
		if (value !== null) {
			parseRequiredPositiveInteger(value, parameter);
		}
	}

	const numberParams = [
		'price_per_lb_min',
		'price_per_lb_max',
		'cost_lb_min',
		'cost_lb_max',
		'score_value_min',
		'score_value_max',
		'processing_confidence_min'
	];

	for (const parameter of numberParams) {
		const value = url.searchParams.get(parameter);
		if (value !== null) {
			parseRequiredNumber(value, parameter);
		}
	}

	const processingConfidenceMin = url.searchParams.get('processing_confidence_min');
	if (processingConfidenceMin !== null) {
		const parsedConfidence = parseRequiredNumber(
			processingConfidenceMin,
			'processing_confidence_min'
		);
		if (parsedConfidence < 0 || parsedConfidence > 1) {
			throw new CatalogQueryValidationError(
				'processing_confidence_min',
				processingConfidenceMin,
				'number between 0 and 1'
			);
		}
	}
}

function parseOptionalBoolean(value: string | null, parameter: string): boolean | undefined {
	if (value === null) return undefined;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new CatalogQueryValidationError(parameter, value, 'true or false');
}

function toCatalogResourceItem(item: CatalogResourceQueryItem): CatalogResourceItem {
	const {
		coffee_user: _coffeeUser,
		processing_evidence: processingEvidence,
		processing_evidence_schema_version: processingEvidenceSchemaVersion,
		...resourceItem
	} = item;
	return {
		...resourceItem,
		process: {
			base_method: item.processing_base_method,
			fermentation_type: item.fermentation_type,
			additives: item.process_additives,
			additive_detail: item.process_additive_detail,
			fermentation_duration_hours: item.fermentation_duration_hours,
			drying_method: item.drying_method,
			notes: item.processing_notes,
			disclosure_level: item.processing_disclosure_level,
			confidence: item.processing_confidence,
			evidence_available: processingEvidenceSchemaVersion != null || processingEvidence != null
		}
	};
}

function parseOptionalNumberFromAliases(url: URL, ...paramNames: string[]): number | undefined {
	for (const paramName of paramNames) {
		const rawValue = url.searchParams.get(paramName);
		if (rawValue === null) continue;
		return parseRequiredNumber(rawValue, paramName);
	}

	return undefined;
}

function parseCatalogQuery(url: URL): ParsedCatalogQuery {
	validateCatalogQuery(url);

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

	const rawSortField = url.searchParams.get('sortField');
	const rawSortDirection = url.searchParams.get('sortDirection');

	if (rawSortDirection !== null && rawSortDirection !== 'asc' && rawSortDirection !== 'desc') {
		throw new CatalogQueryValidationError('sortDirection', rawSortDirection, 'asc or desc');
	}

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
		sortField: rawSortField ?? undefined,
		sortDirection: rawSortDirection ? (rawSortDirection as 'asc' | 'desc') : undefined,
		showWholesale: url.searchParams.get('showWholesale') === 'true',
		wholesaleOnly: url.searchParams.get('wholesaleOnly') === 'true',
		filters: {
			stocked: stockedFilter,
			origin: url.searchParams.get('origin') ?? undefined,
			continent: url.searchParams.get('continent') ?? undefined,
			country: countryFilter,
			source: url.searchParams.getAll('source'),
			processing: url.searchParams.get('processing') ?? undefined,
			processingBaseMethod: url.searchParams.get('processing_base_method') ?? undefined,
			fermentationType: url.searchParams.get('fermentation_type') ?? undefined,
			processAdditive: url.searchParams.get('process_additive') ?? undefined,
			hasAdditives: parseOptionalBoolean(url.searchParams.get('has_additives'), 'has_additives'),
			processingDisclosureLevel: url.searchParams.get('processing_disclosure_level') ?? undefined,
			processingConfidenceMin:
				url.searchParams.get('processing_confidence_min') !== null
					? parseRequiredNumber(
							url.searchParams.get('processing_confidence_min')!,
							'processing_confidence_min'
						)
					: undefined,
			cultivarDetail: url.searchParams.get('cultivar_detail') ?? undefined,
			type: url.searchParams.get('type') ?? undefined,
			grade: url.searchParams.get('grade') ?? undefined,
			appearance: url.searchParams.get('appearance') ?? undefined,
			name: url.searchParams.get('name') ?? undefined,
			region: url.searchParams.get('region') ?? undefined,
			scoreValueMin:
				url.searchParams.get('score_value_min') !== null
					? parseRequiredNumber(url.searchParams.get('score_value_min')!, 'score_value_min')
					: undefined,
			scoreValueMax:
				url.searchParams.get('score_value_max') !== null
					? parseRequiredNumber(url.searchParams.get('score_value_max')!, 'score_value_max')
					: undefined,
			// cost_lb_* remains as a deprecated compatibility alias. The actual filter
			// source of truth is price_per_lb, so prefer the canonical params when present.
			pricePerLbMin: parseOptionalNumberFromAliases(url, 'price_per_lb_min', 'cost_lb_min'),
			pricePerLbMax: parseOptionalNumberFromAliases(url, 'price_per_lb_max', 'cost_lb_max'),
			arrivalDate: url.searchParams.get('arrival_date') ?? undefined,
			stockedDate: url.searchParams.get('stocked_date') ?? undefined,
			stockedDays:
				url.searchParams.get('stocked_days') !== null
					? parseRequiredPositiveInteger(url.searchParams.get('stocked_days')!, 'stocked_days')
					: undefined
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
	const effectiveQuery = query;

	// Preserve the existing specialized contracts for explicit ID fetches and
	// dropdown projection requests. Default pagination is only for the standard
	// canonical listing response when callers omit both page and limit.
	const useDefaultPagination =
		options.forceDefaultPagination === true &&
		!effectiveQuery.isPaginated &&
		effectiveQuery.ids.length === 0 &&
		effectiveQuery.fields !== 'dropdown';
	const requestedPage = effectiveQuery.isPaginated ? effectiveQuery.page : 1;
	const requestedLimit = effectiveQuery.isPaginated
		? effectiveQuery.limit
		: useDefaultPagination
			? DEFAULT_CATALOG_LISTING_LIMIT
			: effectiveQuery.limit;
	const requestedOffset = effectiveQuery.isPaginated ? effectiveQuery.offset : 0;
	const useRowLimitedPagination =
		!effectiveQuery.isPaginated && !useDefaultPagination && context.rowLimit !== null;
	const isPaginated = effectiveQuery.isPaginated || useDefaultPagination || useRowLimitedPagination;
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
		effectiveQuery.filters.stocked !== undefined ? effectiveQuery.filters.stocked : true;

	if (effectiveQuery.fields === 'dropdown' && effectiveQuery.ids.length === 0) {
		if (!isPaginated) {
			// getCatalogDropdown now supports stockedFilter directly (3-way: true/false/null)
			const rows = await getCatalogDropdown(context.supabase, {
				stockedFilter,
				publicOnly: context.publicOnly,
				showWholesale: context.showWholesale,
				wholesaleOnly: context.wholesaleOnly,
				origin: effectiveQuery.filters.origin,
				continent: effectiveQuery.filters.continent,
				country: effectiveQuery.filters.country,
				source:
					effectiveQuery.filters.source && effectiveQuery.filters.source.length > 0
						? effectiveQuery.filters.source
						: undefined,
				processing: effectiveQuery.filters.processing,
				processingBaseMethod: effectiveQuery.filters.processingBaseMethod,
				fermentationType: effectiveQuery.filters.fermentationType,
				processAdditive: effectiveQuery.filters.processAdditive,
				hasAdditives: effectiveQuery.filters.hasAdditives,
				processingDisclosureLevel: effectiveQuery.filters.processingDisclosureLevel,
				processingConfidenceMin: effectiveQuery.filters.processingConfidenceMin,
				cultivarDetail: effectiveQuery.filters.cultivarDetail,
				type: effectiveQuery.filters.type,
				grade: effectiveQuery.filters.grade,
				appearance: effectiveQuery.filters.appearance,
				name: effectiveQuery.filters.name,
				region: effectiveQuery.filters.region,
				scoreValueMin: effectiveQuery.filters.scoreValueMin,
				scoreValueMax: effectiveQuery.filters.scoreValueMax,
				pricePerLbMin: effectiveQuery.filters.pricePerLbMin,
				pricePerLbMax: effectiveQuery.filters.pricePerLbMax,
				arrivalDate: effectiveQuery.filters.arrivalDate,
				stockedDate: effectiveQuery.filters.stockedDate,
				stockedDays: effectiveQuery.filters.stockedDays,
				orderBy: effectiveQuery.sortField || 'arrival_date',
				orderDirection: effectiveQuery.sortDirection || 'desc'
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

		const dropdownResult = await searchCatalogDropdown(context.supabase, {
			stockedFilter,
			publicOnly: context.publicOnly,
			showWholesale: context.showWholesale,
			wholesaleOnly: context.wholesaleOnly,
			origin: effectiveQuery.filters.origin,
			continent: effectiveQuery.filters.continent,
			country: effectiveQuery.filters.country,
			source:
				effectiveQuery.filters.source && effectiveQuery.filters.source.length > 0
					? effectiveQuery.filters.source
					: undefined,
			processing: effectiveQuery.filters.processing,
			processingBaseMethod: effectiveQuery.filters.processingBaseMethod,
			fermentationType: effectiveQuery.filters.fermentationType,
			processAdditive: effectiveQuery.filters.processAdditive,
			hasAdditives: effectiveQuery.filters.hasAdditives,
			processingDisclosureLevel: effectiveQuery.filters.processingDisclosureLevel,
			processingConfidenceMin: effectiveQuery.filters.processingConfidenceMin,
			cultivarDetail: effectiveQuery.filters.cultivarDetail,
			type: effectiveQuery.filters.type,
			grade: effectiveQuery.filters.grade,
			appearance: effectiveQuery.filters.appearance,
			name: effectiveQuery.filters.name,
			region: effectiveQuery.filters.region,
			scoreValueMin: effectiveQuery.filters.scoreValueMin,
			scoreValueMax: effectiveQuery.filters.scoreValueMax,
			pricePerLbMin: effectiveQuery.filters.pricePerLbMin,
			pricePerLbMax: effectiveQuery.filters.pricePerLbMax,
			arrivalDate: effectiveQuery.filters.arrivalDate,
			stockedDate: effectiveQuery.filters.stockedDate,
			stockedDays: effectiveQuery.filters.stockedDays,
			orderBy: effectiveQuery.sortField || 'arrival_date',
			orderDirection: effectiveQuery.sortDirection || 'desc',
			limit: effectiveLimit,
			offset
		});

		const totalAvailable = dropdownResult.count || dropdownResult.data.length;
		const totalPages = Math.ceil(totalAvailable / effectiveLimit);

		return {
			data: dropdownResult.data,
			pagination: {
				page,
				limit: effectiveLimit,
				total: totalAvailable,
				totalPages,
				hasNext: page < totalPages,
				hasPrev: page > 1
			},
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

	const result = await searchCatalog(context.supabase, {
		stockedFilter,
		publicOnly: context.publicOnly,
		showWholesale: context.showWholesale,
		wholesaleOnly: context.wholesaleOnly,
		coffeeIds: effectiveQuery.ids.length > 0 ? effectiveQuery.ids : undefined,
		origin: effectiveQuery.filters.origin,
		continent: effectiveQuery.filters.continent,
		country: effectiveQuery.filters.country,
		source:
			effectiveQuery.filters.source && effectiveQuery.filters.source.length > 0
				? effectiveQuery.filters.source
				: undefined,
		processing: effectiveQuery.filters.processing,
		processingBaseMethod: effectiveQuery.filters.processingBaseMethod,
		fermentationType: effectiveQuery.filters.fermentationType,
		processAdditive: effectiveQuery.filters.processAdditive,
		hasAdditives: effectiveQuery.filters.hasAdditives,
		processingDisclosureLevel: effectiveQuery.filters.processingDisclosureLevel,
		processingConfidenceMin: effectiveQuery.filters.processingConfidenceMin,
		cultivarDetail: effectiveQuery.filters.cultivarDetail,
		type: effectiveQuery.filters.type,
		grade: effectiveQuery.filters.grade,
		appearance: effectiveQuery.filters.appearance,
		name: effectiveQuery.filters.name,
		region: effectiveQuery.filters.region,
		scoreValueMin: effectiveQuery.filters.scoreValueMin,
		scoreValueMax: effectiveQuery.filters.scoreValueMax,
		pricePerLbMin: effectiveQuery.filters.pricePerLbMin,
		pricePerLbMax: effectiveQuery.filters.pricePerLbMax,
		arrivalDate: effectiveQuery.filters.arrivalDate,
		stockedDate: effectiveQuery.filters.stockedDate,
		stockedDays: effectiveQuery.filters.stockedDays,
		fields: 'resource',
		orderBy: effectiveQuery.ids.length > 0 ? 'name' : effectiveQuery.sortField || 'arrival_date',
		orderDirection:
			effectiveQuery.sortDirection || (effectiveQuery.ids.length > 0 ? 'asc' : 'desc'),
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
	let context: CatalogAccessContext | null = null;

	try {
		const query = parseCatalogQuery(event.url);
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

		if (error instanceof CatalogQueryValidationError) {
			return {
				status: 400,
				body: {
					error: 'Invalid query parameter',
					message: error.message,
					details: {
						parameter: error.parameter,
						value: error.value,
						expected: error.expected
					}
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
