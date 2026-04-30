import type { RequestEvent } from '@sveltejs/kit';
import {
	checkRateLimit,
	getApiRowLimit,
	logApiUsage,
	type ApiPlan,
	type RateLimitResult
} from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { jsonResponse } from '$lib/server/http';
import { createAdminClient } from '$lib/supabase-admin';

export interface PriceIndexPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface PriceIndexItem {
	date: string;
	origin: string;
	process: string | null;
	grade: string | null;
	wholesale: boolean;
	price: {
		min: number | null;
		max: number | null;
		avg: number | null;
		median: number | null;
		p25: number | null;
		p75: number | null;
		stdev: number | null;
	};
	sample: {
		suppliers: number;
		listings: number;
		aggregation_tier: number | null;
	};
	provenance: {
		synthetic: boolean;
	};
}

export interface CanonicalPriceIndexResponse {
	data: PriceIndexItem[];
	pagination: PriceIndexPagination;
	meta: {
		resource: 'price-index';
		namespace: '/v1/price-index';
		version: 'v1';
		auth: {
			kind: 'api-key';
			apiPlan: ApiPlan;
			ppiAccess: true;
		};
		filters: {
			origin: string | null;
			process: string | null;
			grade: string | null;
			from: string | null;
			to: string | null;
			wholesale: boolean | null;
		};
		access: {
			rowLimit: number | null;
			limited: boolean;
			totalAvailable: number;
		};
		source: {
			table: 'price_index_snapshots';
			aggregateOnly: true;
		};
	};
}

interface ParsedPriceIndexQuery {
	page: number;
	limit: number;
	offset: number;
	filters: {
		origin: string | null;
		process: string | null;
		grade: string | null;
		from: string | null;
		to: string | null;
		wholesale: boolean | null;
	};
}

interface PriceIndexSnapshotRow {
	id: string;
	snapshot_date: string;
	origin: string;
	process: string | null;
	grade: string | null;
	wholesale_only: boolean;
	price_min: number | string | null;
	price_max: number | string | null;
	price_avg: number | string | null;
	price_median: number | string | null;
	price_p25: number | string | null;
	price_p75: number | string | null;
	price_stdev: number | string | null;
	supplier_count: number | string;
	sample_size: number | string;
	aggregation_tier: number | string | null;
	synthetic: boolean | null;
}

interface PriceIndexQueryResult {
	data: PriceIndexSnapshotRow[] | null;
	error: { message: string } | null;
	count: number | null;
}

interface PriceIndexQueryBuilder {
	eq(column: string, value: string | boolean): PriceIndexQueryBuilder;
	gte(column: string, value: string): PriceIndexQueryBuilder;
	lte(column: string, value: string): PriceIndexQueryBuilder;
	order(column: string, options: { ascending: boolean }): PriceIndexQueryBuilder;
	range(from: number, to: number): Promise<PriceIndexQueryResult>;
}

interface PriceIndexSupabaseClient {
	from(table: 'price_index_snapshots'): {
		select(columns: string, options: { count: 'exact' }): PriceIndexQueryBuilder;
	};
}

const DEFAULT_PRICE_INDEX_LIMIT = 100;
const MAX_PRICE_INDEX_LIMIT = 100;
const ISO_DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STRING_PARAM_MAX_LENGTH = 128;
const PRICE_INDEX_SELECT =
	'id, snapshot_date, origin, process, grade, wholesale_only, price_min, price_max, price_avg, price_median, price_p25, price_p75, price_stdev, supplier_count, sample_size, aggregation_tier, synthetic';
const PRICE_INDEX_ORDER_COLUMNS = [
	{ column: 'snapshot_date', ascending: false },
	{ column: 'origin', ascending: true },
	{ column: 'process', ascending: true },
	{ column: 'grade', ascending: true },
	{ column: 'wholesale_only', ascending: true },
	{ column: 'synthetic', ascending: true },
	{ column: 'id', ascending: true }
] as const;

class PriceIndexRateLimitError extends Error {
	constructor(
		public apiKeyId: string,
		public requestPath: string,
		public result: RateLimitResult
	) {
		super('API rate limit exceeded for your subscription plan');
		this.name = 'PriceIndexRateLimitError';
	}
}

class PriceIndexQueryValidationError extends Error {
	constructor(
		public parameter: string,
		public value: string,
		public expected: string
	) {
		super(`Query parameter "${parameter}" must use ${expected}`);
		this.name = 'PriceIndexQueryValidationError';
	}
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

function parseRequiredPositiveInteger(value: string, parameter: string): number {
	if (!/^\d+$/.test(value)) {
		throw new PriceIndexQueryValidationError(parameter, value, 'positive integer');
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new PriceIndexQueryValidationError(parameter, value, 'positive integer');
	}

	return parsed;
}

function parseOptionalStringParam(url: URL, parameter: string): string | null {
	const rawValue = url.searchParams.get(parameter);
	if (rawValue === null) return null;

	const value = rawValue.trim();
	if (value.length === 0) {
		throw new PriceIndexQueryValidationError(parameter, rawValue, 'non-empty string');
	}

	if (value.length > STRING_PARAM_MAX_LENGTH) {
		throw new PriceIndexQueryValidationError(
			parameter,
			rawValue,
			`string no longer than ${STRING_PARAM_MAX_LENGTH} characters`
		);
	}

	return value;
}

function parseOptionalDateParam(url: URL, parameter: string): string | null {
	const value = url.searchParams.get(parameter);
	if (value === null) return null;
	if (!isIsoDateParam(value)) {
		throw new PriceIndexQueryValidationError(parameter, value, 'YYYY-MM-DD');
	}
	return value;
}

function parseOptionalBooleanParam(url: URL, parameter: string): boolean | null {
	const value = url.searchParams.get(parameter);
	if (value === null) return null;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new PriceIndexQueryValidationError(parameter, value, 'true or false');
}

function parsePriceIndexQuery(url: URL): ParsedPriceIndexQuery {
	const format = url.searchParams.get('format');
	if (format !== null && format !== 'json') {
		throw new PriceIndexQueryValidationError('format', format, 'json');
	}

	const page = url.searchParams.has('page')
		? parseRequiredPositiveInteger(url.searchParams.get('page')!, 'page')
		: 1;
	const limit = url.searchParams.has('limit')
		? parseRequiredPositiveInteger(url.searchParams.get('limit')!, 'limit')
		: DEFAULT_PRICE_INDEX_LIMIT;

	if (limit > MAX_PRICE_INDEX_LIMIT) {
		throw new PriceIndexQueryValidationError(
			'limit',
			url.searchParams.get('limit')!,
			`positive integer less than or equal to ${MAX_PRICE_INDEX_LIMIT}`
		);
	}

	const from = parseOptionalDateParam(url, 'from');
	const to = parseOptionalDateParam(url, 'to');
	if (from && to && from > to) {
		throw new PriceIndexQueryValidationError(
			'from',
			from,
			'date before or equal to the to parameter'
		);
	}

	return {
		page,
		limit,
		offset: (page - 1) * limit,
		filters: {
			origin: parseOptionalStringParam(url, 'origin'),
			process: parseOptionalStringParam(url, 'process'),
			grade: parseOptionalStringParam(url, 'grade'),
			from,
			to,
			wholesale: parseOptionalBooleanParam(url, 'wholesale')
		}
	};
}

function toNullableNumber(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: number | string | null | undefined, fallback = 0): number {
	if (value === null || value === undefined) return fallback;
	const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function toPriceIndexItem(row: PriceIndexSnapshotRow): PriceIndexItem {
	return {
		date: row.snapshot_date,
		origin: row.origin,
		process: row.process ?? null,
		grade: row.grade ?? null,
		wholesale: row.wholesale_only === true,
		price: {
			min: toNullableNumber(row.price_min),
			max: toNullableNumber(row.price_max),
			avg: toNullableNumber(row.price_avg),
			median: toNullableNumber(row.price_median),
			p25: toNullableNumber(row.price_p25),
			p75: toNullableNumber(row.price_p75),
			stdev: toNullableNumber(row.price_stdev)
		},
		sample: {
			suppliers: toInteger(row.supplier_count),
			listings: toInteger(row.sample_size),
			aggregation_tier: toNullableNumber(row.aggregation_tier)
		},
		provenance: {
			synthetic: row.synthetic === true
		}
	};
}

function buildRateLimitHeaders(rateLimit: RateLimitResult): Headers {
	return new Headers({
		'X-RateLimit-Limit': rateLimit.limit.toString(),
		'X-RateLimit-Remaining': rateLimit.remaining.toString(),
		'X-RateLimit-Reset': Math.floor(rateLimit.resetTime.getTime() / 1000).toString()
	});
}

async function logPriceIndexApiUsage(
	apiKeyId: string | null,
	requestPath: string,
	event: RequestEvent,
	statusCode: number,
	startTime: number
) {
	if (!apiKeyId) return;

	await logApiUsage(
		apiKeyId,
		requestPath,
		statusCode,
		Date.now() - startTime,
		event.request.headers.get('User-Agent') || undefined,
		event.request.headers.get('X-Forwarded-For') || undefined
	);
}

async function queryPriceIndexData(
	query: ParsedPriceIndexQuery,
	effectiveLimit: number,
	rowLimit: number | null,
	apiPlan: ApiPlan
): Promise<CanonicalPriceIndexResponse> {
	// price_index_snapshots is ahead of generated Database types in some environments,
	// so this aggregate-only reader intentionally uses a narrow runtime row contract.
	const supabase = createAdminClient() as unknown as PriceIndexSupabaseClient;
	let dbQuery = supabase
		.from('price_index_snapshots')
		.select(PRICE_INDEX_SELECT, { count: 'exact' });

	if (query.filters.origin !== null) dbQuery = dbQuery.eq('origin', query.filters.origin);
	if (query.filters.process !== null) dbQuery = dbQuery.eq('process', query.filters.process);
	if (query.filters.grade !== null) dbQuery = dbQuery.eq('grade', query.filters.grade);
	if (query.filters.from !== null) dbQuery = dbQuery.gte('snapshot_date', query.filters.from);
	if (query.filters.to !== null) dbQuery = dbQuery.lte('snapshot_date', query.filters.to);
	if (query.filters.wholesale !== null) {
		dbQuery = dbQuery.eq('wholesale_only', query.filters.wholesale);
	}

	for (const order of PRICE_INDEX_ORDER_COLUMNS) {
		dbQuery = dbQuery.order(order.column, { ascending: order.ascending });
	}

	const end = query.offset + effectiveLimit - 1;
	const { data, error, count } = await dbQuery.range(query.offset, end);

	if (error) {
		throw new Error(`Failed to query price index snapshots: ${error.message}`);
	}

	const rows = (data ?? []) as PriceIndexSnapshotRow[];
	const totalAvailable = count ?? rows.length;
	const totalPages = Math.ceil(totalAvailable / effectiveLimit);

	return {
		data: rows.map(toPriceIndexItem),
		pagination: {
			page: query.page,
			limit: effectiveLimit,
			total: totalAvailable,
			totalPages,
			hasNext: query.page < totalPages,
			hasPrev: query.page > 1
		},
		meta: {
			resource: 'price-index',
			namespace: '/v1/price-index',
			version: 'v1',
			auth: {
				kind: 'api-key',
				apiPlan,
				ppiAccess: true
			},
			filters: query.filters,
			access: {
				rowLimit,
				limited: rowLimit !== null && totalAvailable > rowLimit,
				totalAvailable
			},
			source: {
				table: 'price_index_snapshots',
				aggregateOnly: true
			}
		}
	};
}

export async function buildCanonicalPriceIndexResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	const startTime = Date.now();
	let apiKeyId: string | null = null;

	try {
		const principal = await requireApiKeyAccess(event, {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		apiKeyId = principal.apiKeyId;

		if (!principal.ppiAccess) {
			await logPriceIndexApiUsage(apiKeyId, requestPath, event, 403, startTime);
			return jsonResponse(
				{
					error: 'Insufficient permissions',
					message: 'Parchment Intelligence access is required for /v1/price-index',
					requiredEntitlement: 'ppiAccess'
				},
				{ status: 403 }
			);
		}

		const query = parsePriceIndexQuery(event.url);
		const rowLimitValue = getApiRowLimit(principal.apiPlan);
		const rowLimit = rowLimitValue > 0 ? rowLimitValue : null;
		const effectiveLimit = rowLimit === null ? query.limit : Math.min(query.limit, rowLimit);
		const rateLimit = await checkRateLimit(principal.apiKeyId, principal.apiPlan);

		if (!rateLimit.allowed) {
			throw new PriceIndexRateLimitError(principal.apiKeyId, requestPath, rateLimit);
		}

		const body = await queryPriceIndexData(query, effectiveLimit, rowLimit, principal.apiPlan);
		await logPriceIndexApiUsage(apiKeyId, requestPath, event, 200, startTime);

		return jsonResponse(body, {
			status: 200,
			headers: buildRateLimitHeaders(rateLimit)
		});
	} catch (error) {
		if (error instanceof PriceIndexRateLimitError) {
			await logPriceIndexApiUsage(error.apiKeyId, error.requestPath, event, 429, startTime);
			const headers = buildRateLimitHeaders(error.result);
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
			return jsonResponse(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{ status: error.status }
			);
		}

		if (error instanceof PriceIndexQueryValidationError) {
			await logPriceIndexApiUsage(apiKeyId, requestPath, event, 400, startTime);
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

		const safeError = error instanceof Error ? error.message : String(error);
		console.error('Error querying price index:', safeError);
		await logPriceIndexApiUsage(apiKeyId, requestPath, event, 500, startTime);

		return jsonResponse(
			{ error: 'Failed to fetch price index data', message: 'Internal server error' },
			{ status: 500 }
		);
	}
}
