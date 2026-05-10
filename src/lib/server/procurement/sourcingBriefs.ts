import type { RequestEvent } from '@sveltejs/kit';
import {
	checkRateLimit,
	logApiUsage,
	type ApiPlan,
	type RateLimitResult
} from '$lib/server/apiAuth';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import {
	isApiKeyPrincipal,
	isSessionPrincipal,
	isTrustedMutationRequest,
	principalHasRole,
	resolvePrincipal,
	type RequestPrincipal
} from '$lib/server/principal';
import { jsonResponse } from '$lib/server/http';
import { searchCatalog, type CatalogItem } from '$lib/data/catalog';
import { toCatalogResourceItem, type CatalogResponseItem } from '$lib/catalog/catalogResourceItem';
import { createAdminClient } from '$lib/supabase-admin';
import type { UserRole } from '$lib/types/auth.types';
import type { Json } from '$lib/types/database.types';
import {
	SourcingBriefCriteriaValidationError,
	SOURCING_BRIEF_ALLOWED_FIELDS,
	sourcingBriefCriteriaToCatalogSearchOptions,
	validateSourcingBriefCriteria,
	type SourcingBriefCriteria
} from '$lib/procurement/sourcingBriefCriteria';

export type SourcingBriefAuthKind = 'session' | 'api-key';

type SupabaseLike = ReturnType<typeof createAdminClient>;

export interface SourcingBriefRow {
	id: string;
	user_id: string;
	name: string;
	criteria: Json;
	cadence: 'manual';
	is_active: boolean;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface SourcingBriefResource {
	id: string;
	name: string;
	criteria: SourcingBriefCriteria;
	cadence: 'manual';
	isActive: boolean;
	lastRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

interface ProcurementAccessContext {
	principal: RequestPrincipal;
	authKind: SourcingBriefAuthKind;
	userId: string;
	role: UserRole | null;
	apiPlan: ApiPlan | null;
	apiKeyId: string | null;
	rateLimitHeaders: Headers | null;
	requestPath: string;
	supabase: SupabaseLike;
}

interface CreateSourcingBriefInput {
	name?: unknown;
	criteria?: unknown;
	cadence?: unknown;
}

interface MatchPaginationQuery {
	page: number;
	limit: number;
	offset: number;
}

class SourcingBriefRateLimitError extends Error {
	constructor(
		public apiKeyId: string,
		public requestPath: string,
		public result: RateLimitResult
	) {
		super('API rate limit exceeded for your subscription plan');
		this.name = 'SourcingBriefRateLimitError';
	}
}

class SourcingBriefNotFoundError extends Error {
	constructor() {
		super('Sourcing brief not found');
		this.name = 'SourcingBriefNotFoundError';
	}
}

class SourcingBriefRequestValidationError extends Error {
	constructor(
		public field: string,
		message: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'SourcingBriefRequestValidationError';
	}
}

const DEFAULT_MATCH_LIMIT = 25;
const MAX_MATCH_LIMIT = 100;

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parsePositiveInteger(value: string | null, fallback: number, field: string): number {
	if (value === null) return fallback;
	if (!/^\d+$/.test(value)) {
		throw new SourcingBriefRequestValidationError(field, `${field} must be a positive integer`);
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new SourcingBriefRequestValidationError(field, `${field} must be a positive integer`);
	}
	return parsed;
}

function parseMatchPagination(url: URL): MatchPaginationQuery {
	const page = parsePositiveInteger(url.searchParams.get('page'), 1, 'page');
	const requestedLimit = parsePositiveInteger(
		url.searchParams.get('limit'),
		DEFAULT_MATCH_LIMIT,
		'limit'
	);
	if (requestedLimit > MAX_MATCH_LIMIT) {
		throw new SourcingBriefRequestValidationError(
			'limit',
			`limit must be less than or equal to ${MAX_MATCH_LIMIT}`
		);
	}
	return {
		page,
		limit: requestedLimit,
		offset: (page - 1) * requestedLimit
	};
}

function normalizeName(value: unknown): string {
	if (typeof value !== 'string') {
		throw new SourcingBriefRequestValidationError('name', 'name must be a string');
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new SourcingBriefRequestValidationError('name', 'name must not be empty');
	}
	if (trimmed.length > 120) {
		throw new SourcingBriefRequestValidationError('name', 'name must be 120 characters or fewer');
	}
	return trimmed;
}

function normalizeCadence(value: unknown): 'manual' {
	if (value === undefined || value === null || value === 'manual') return 'manual';
	throw new SourcingBriefRequestValidationError('cadence', 'cadence must be manual', {
		allowedValues: ['manual']
	});
}

function parseCreateInput(input: unknown): {
	name: string;
	criteria: SourcingBriefCriteria;
	cadence: 'manual';
} {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		throw new SourcingBriefRequestValidationError('body', 'request body must be a JSON object');
	}
	const body = input as CreateSourcingBriefInput;
	return {
		name: normalizeName(body.name),
		criteria: validateSourcingBriefCriteria(body.criteria),
		cadence: normalizeCadence(body.cadence)
	};
}

async function parseJsonBody(event: RequestEvent): Promise<unknown> {
	try {
		return await event.request.json();
	} catch {
		throw new SourcingBriefRequestValidationError('body', 'request body must be valid JSON');
	}
}

function buildRateLimitHeaders(result: RateLimitResult): Headers {
	return new Headers({
		'X-RateLimit-Limit': result.limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString()
	});
}

async function resolveProcurementAccessContext(
	event: RequestEvent,
	requestPath: string
): Promise<ProcurementAccessContext> {
	const principal = await resolvePrincipal(event);
	const hasAuthorizationHeader = event.request.headers.has('Authorization');

	if (hasAuthorizationHeader && !principal.isAuthenticated) {
		throw new AuthError('Authentication required');
	}

	if (isApiKeyPrincipal(principal)) {
		const apiPrincipal = await requireApiKeyAccess(event, {
			requiredPlan: 'member',
			requiredScope: 'catalog:read'
		});
		const rateLimit = await checkRateLimit(apiPrincipal.apiKeyId, apiPrincipal.apiPlan);
		if (!rateLimit.allowed) {
			throw new SourcingBriefRateLimitError(apiPrincipal.apiKeyId, requestPath, rateLimit);
		}
		return {
			principal: apiPrincipal,
			authKind: 'api-key',
			userId: apiPrincipal.userId,
			role: apiPrincipal.primaryAppRole,
			apiPlan: apiPrincipal.apiPlan,
			apiKeyId: apiPrincipal.apiKeyId,
			rateLimitHeaders: buildRateLimitHeaders(rateLimit),
			requestPath,
			supabase: createAdminClient()
		};
	}

	if (!isSessionPrincipal(principal)) {
		throw new AuthError('Authentication required');
	}

	if (!principalHasRole(principal, 'member')) {
		throw new AuthError('Member role required', 403);
	}

	if (!isTrustedMutationRequest(event, principal)) {
		throw new AuthError('Cross-site session mutation blocked', 403);
	}

	return {
		principal,
		authKind: 'session',
		userId: principal.userId,
		role: principal.primaryAppRole,
		apiPlan: principal.apiPlan,
		apiKeyId: null,
		rateLimitHeaders: null,
		requestPath,
		supabase: createAdminClient()
	};
}

async function logProcurementApiUsage(
	context: Pick<ProcurementAccessContext, 'apiKeyId' | 'requestPath'> | null,
	event: RequestEvent,
	statusCode: number,
	startTime: number
) {
	if (!context?.apiKeyId) return;
	await logApiUsage(
		context.apiKeyId,
		context.requestPath,
		statusCode,
		Date.now() - startTime,
		event.request.headers.get('User-Agent') || undefined,
		event.request.headers.get('X-Forwarded-For') || undefined
	);
}

function toBriefResource(row: SourcingBriefRow): SourcingBriefResource {
	return {
		id: row.id,
		name: row.name,
		criteria: validateSourcingBriefCriteria(row.criteria),
		cadence: row.cadence,
		isActive: row.is_active,
		lastRunAt: row.last_run_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function table(client: SupabaseLike) {
	return client.from('sourcing_briefs');
}

async function createSourcingBrief(
	context: ProcurementAccessContext,
	input: { name: string; criteria: SourcingBriefCriteria; cadence: 'manual' }
): Promise<SourcingBriefResource> {
	const { data, error } = await table(context.supabase)
		.insert({
			user_id: context.userId,
			name: input.name,
			criteria: input.criteria as unknown as Json,
			cadence: input.cadence,
			is_active: true
		})
		.select('*')
		.single();

	if (error) throw error;
	return toBriefResource(data as unknown as SourcingBriefRow);
}

async function listSourcingBriefs(
	context: ProcurementAccessContext
): Promise<SourcingBriefResource[]> {
	const { data, error } = await table(context.supabase)
		.select('*')
		.eq('user_id', context.userId)
		.eq('is_active', true)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return ((data ?? []) as unknown as SourcingBriefRow[]).map(toBriefResource);
}

async function getSourcingBriefRow(
	context: ProcurementAccessContext,
	id: string
): Promise<SourcingBriefRow> {
	if (!isUuid(id)) {
		throw new SourcingBriefNotFoundError();
	}

	const { data, error } = await table(context.supabase)
		.select('*')
		.eq('id', id)
		.eq('user_id', context.userId)
		.eq('is_active', true)
		.maybeSingle();

	if (error) throw error;
	if (!data) throw new SourcingBriefNotFoundError();
	return data as unknown as SourcingBriefRow;
}

function reasonIf(condition: boolean, reason: string): string[] {
	return condition ? [reason] : [];
}

function textIncludes(value: string | null | undefined, expected: string | undefined): boolean {
	return Boolean(value && expected && value.toLowerCase().includes(expected.toLowerCase()));
}

function computeMatchReasons(criteria: SourcingBriefCriteria, row: CatalogItem): string[] {
	return [
		...reasonIf(Boolean(criteria.country && row.country === criteria.country), 'country_match'),
		...reasonIf(textIncludes(row.region, criteria.region), 'region_match'),
		...reasonIf(textIncludes(row.processing, criteria.processing), 'processing_match'),
		...reasonIf(
			Boolean(
				criteria.processing_base_method &&
					row.processing_base_method === criteria.processing_base_method
			),
			'processing_base_method_match'
		),
		...reasonIf(
			Boolean(
				criteria.max_price_per_lb !== undefined &&
					row.price_per_lb !== null &&
					row.price_per_lb <= criteria.max_price_per_lb
			),
			'price_under_target'
		),
		...reasonIf(Boolean(criteria.stocked_only === true && row.stocked === true), 'stocked_now'),
		...reasonIf(
			Boolean(criteria.wholesale_only === true && row.wholesale === true),
			'wholesale_match'
		),
		...reasonIf(
			Boolean(criteria.stocked_days !== undefined && row.stocked_date),
			'fresh_stocked_date'
		)
	];
}

function createMatches(
	criteria: SourcingBriefCriteria,
	rows: CatalogItem[]
): Array<CatalogResponseItem & { matchReasons: string[] }> {
	return rows.map((row) => ({
		...toCatalogResourceItem(row),
		matchReasons: computeMatchReasons(criteria, row)
	}));
}

async function runSourcingBriefMatches(
	context: ProcurementAccessContext,
	row: SourcingBriefRow,
	pagination: MatchPaginationQuery
) {
	const criteria = validateSourcingBriefCriteria(row.criteria);
	const catalogOptions = sourcingBriefCriteriaToCatalogSearchOptions(criteria);
	const result = await searchCatalog(
		context.supabase as unknown as Parameters<typeof searchCatalog>[0],
		{
			...catalogOptions,
			fields: 'resource',
			publicOnly: false,
			showWholesale: true,
			limit: pagination.limit,
			offset: pagination.offset,
			orderBy: 'arrival_date',
			orderDirection: 'desc'
		}
	);
	const totalAvailable = result.count ?? result.data.length;
	const totalPages = Math.ceil(totalAvailable / pagination.limit);
	const generatedAt = new Date().toISOString();

	return {
		data: createMatches(criteria, result.data),
		pagination: {
			page: pagination.page,
			limit: pagination.limit,
			total: totalAvailable,
			totalPages,
			hasNext: pagination.page < totalPages,
			hasPrev: pagination.page > 1
		},
		meta: {
			resource: 'procurement-brief-matches',
			namespace: '/v1/procurement/briefs/:id/matches',
			version: 'v1',
			generatedAt,
			auth: {
				kind: context.authKind,
				role: context.role,
				apiPlan: context.apiPlan
			},
			brief: toBriefResource(row),
			criteria,
			limitations: [
				'Matches are deterministic catalog rows that satisfy saved criteria before pagination.',
				'Match reasons explain why rows satisfied explicit constraints; they are not quality rankings.',
				'Only currently supported criteria are applied; unsupported criteria are rejected at write time.'
			]
		}
	};
}

function createValidationBody(error: SourcingBriefRequestValidationError) {
	return {
		error: 'Invalid request',
		message: error.message,
		details: {
			field: error.field,
			...(error.details && typeof error.details === 'object' ? (error.details as object) : {})
		}
	};
}

function createCriteriaValidationBody(error: SourcingBriefCriteriaValidationError) {
	return {
		error: 'Invalid criteria',
		message: 'Sourcing brief criteria contains unsupported or invalid fields',
		details: {
			issues: error.issues,
			allowedFields: SOURCING_BRIEF_ALLOWED_FIELDS
		}
	};
}

function responseWithRateHeaders(body: unknown, status: number, headers: Headers | null): Response {
	return jsonResponse(body, { status, headers: headers ?? undefined });
}

async function withProcurementErrors(
	event: RequestEvent,
	requestPath: string,
	handler: (context: ProcurementAccessContext) => Promise<Response>
): Promise<Response> {
	const startTime = Date.now();
	let context: ProcurementAccessContext | null = null;

	try {
		context = await resolveProcurementAccessContext(event, requestPath);
		const response = await handler(context);
		await logProcurementApiUsage(context, event, response.status, startTime);
		return response;
	} catch (error) {
		if (error instanceof SourcingBriefRateLimitError) {
			await logProcurementApiUsage(error, event, 429, startTime);
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
			await logProcurementApiUsage(context, event, error.status, startTime);
			return jsonResponse(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{ status: error.status }
			);
		}

		if (error instanceof SourcingBriefNotFoundError) {
			await logProcurementApiUsage(context, event, 404, startTime);
			return jsonResponse({ error: 'Not found', message: error.message }, { status: 404 });
		}

		if (error instanceof SourcingBriefCriteriaValidationError) {
			await logProcurementApiUsage(context, event, 400, startTime);
			return jsonResponse(createCriteriaValidationBody(error), { status: 400 });
		}

		if (error instanceof SourcingBriefRequestValidationError) {
			await logProcurementApiUsage(context, event, 400, startTime);
			return jsonResponse(createValidationBody(error), { status: 400 });
		}

		const safeError = error instanceof Error ? error.message : String(error);
		console.error('Error serving sourcing brief API:', safeError);
		await logProcurementApiUsage(context, event, 500, startTime);
		return jsonResponse(
			{ error: 'Failed to serve sourcing brief request', message: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function buildSourcingBriefsListResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	return withProcurementErrors(event, requestPath, async (context) => {
		const briefs = await listSourcingBriefs(context);
		return responseWithRateHeaders(
			{
				data: briefs,
				meta: {
					resource: 'procurement-briefs',
					namespace: '/v1/procurement/briefs',
					version: 'v1',
					auth: { kind: context.authKind, role: context.role, apiPlan: context.apiPlan }
				}
			},
			200,
			context.rateLimitHeaders
		);
	});
}

export async function buildSourcingBriefCreateResponse(
	event: RequestEvent,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	return withProcurementErrors(event, requestPath, async (context) => {
		const input = parseCreateInput(await parseJsonBody(event));
		const brief = await createSourcingBrief(context, input);
		return responseWithRateHeaders(
			{
				data: brief,
				meta: {
					resource: 'procurement-brief',
					namespace: '/v1/procurement/briefs',
					version: 'v1',
					auth: { kind: context.authKind, role: context.role, apiPlan: context.apiPlan }
				}
			},
			201,
			context.rateLimitHeaders
		);
	});
}

export async function buildSourcingBriefGetResponse(
	event: RequestEvent,
	id: string,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	return withProcurementErrors(event, requestPath, async (context) => {
		const brief = toBriefResource(await getSourcingBriefRow(context, id));
		return responseWithRateHeaders(
			{
				data: brief,
				meta: {
					resource: 'procurement-brief',
					namespace: '/v1/procurement/briefs/:id',
					version: 'v1',
					auth: { kind: context.authKind, role: context.role, apiPlan: context.apiPlan }
				}
			},
			200,
			context.rateLimitHeaders
		);
	});
}

export async function buildSourcingBriefMatchesResponse(
	event: RequestEvent,
	id: string,
	options: { requestPath?: string } = {}
): Promise<Response> {
	const requestPath = options.requestPath ?? event.url.pathname;
	return withProcurementErrors(event, requestPath, async (context) => {
		const row = await getSourcingBriefRow(context, id);
		const body = await runSourcingBriefMatches(context, row, parseMatchPagination(event.url));
		return responseWithRateHeaders(body, 200, context.rateLimitHeaders);
	});
}
