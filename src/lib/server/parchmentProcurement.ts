import type { ParchmentClient, components } from '@purveyors/sdk';
import type { SourcingBriefMatchSummary } from '$lib/procurement/sourcingBriefPresentation';

export type SourcingBriefCriteria = components['schemas']['SourcingBriefCriteria'];
export type SourcingBriefResource = components['schemas']['SourcingBriefResource'];

export type { SourcingBriefMatchSummary } from '$lib/procurement/sourcingBriefPresentation';

type SourcingBriefListResult = {
	data?: unknown;
	error?: unknown;
};

type SourcingBriefMatchesResult = {
	data?: unknown;
	error?: unknown;
};

const MATCH_PAGE_LIMIT = 100;
const CRITERIA_FIELDS = new Set([
	'version',
	'country',
	'region',
	'processing',
	'processing_base_method',
	'max_price_per_lb',
	'stocked_only',
	'wholesale_only',
	'stocked_days'
]);
const CRITERIA_STRING_FIELDS = [
	'country',
	'region',
	'processing',
	'processing_base_method'
] as const;
const CRITERIA_BOOLEAN_FIELDS = ['stocked_only', 'wholesale_only'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
	throw new Error(`Invalid Parchment procurement response: ${message}`);
}

function requireString(value: unknown, path: string): string {
	if (typeof value !== 'string' || value.length === 0) fail(`${path} must be a non-empty string`);
	return value;
}

function requireBoolean(value: unknown, path: string): boolean {
	if (typeof value !== 'boolean') fail(`${path} must be a boolean`);
	return value;
}

function requireNonNegativeInteger(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
		fail(`${path} must be a non-negative safe integer`);
	}
	return value;
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}

function parseSourcingBriefCriteria(value: unknown, path: string): SourcingBriefCriteria {
	if (!isRecord(value)) fail(`${path} must be an object`);
	if (value.version !== 1) fail(`${path}.version must be 1`);

	for (const key of Object.keys(value)) {
		if (!CRITERIA_FIELDS.has(key)) fail(`${path}.${key} is not supported`);
	}
	for (const field of CRITERIA_STRING_FIELDS) {
		if (value[field] !== undefined && typeof value[field] !== 'string') {
			fail(`${path}.${field} must be a string`);
		}
	}
	for (const field of CRITERIA_BOOLEAN_FIELDS) {
		if (value[field] !== undefined && typeof value[field] !== 'boolean') {
			fail(`${path}.${field} must be a boolean`);
		}
	}
	if (
		value.max_price_per_lb !== undefined &&
		(typeof value.max_price_per_lb !== 'number' || !Number.isFinite(value.max_price_per_lb))
	) {
		fail(`${path}.max_price_per_lb must be a finite number`);
	}
	if (
		value.stocked_days !== undefined &&
		(typeof value.stocked_days !== 'number' ||
			!Number.isFinite(value.stocked_days) ||
			!Number.isInteger(value.stocked_days))
	) {
		fail(`${path}.stocked_days must be an integer`);
	}

	return value as SourcingBriefCriteria;
}

function parseSourcingBrief(value: unknown, path: string): SourcingBriefResource {
	if (!isRecord(value)) fail(`${path} must be an object`);

	const criteria = parseSourcingBriefCriteria(value.criteria, `${path}.criteria`);
	if (value.cadence !== 'manual') fail(`${path}.cadence must be manual`);
	if (value.isActive !== true) fail(`${path}.isActive must be true`);
	if (value.lastRunAt !== null && typeof value.lastRunAt !== 'string') {
		fail(`${path}.lastRunAt must be a string or null`);
	}

	return {
		id: requireString(value.id, `${path}.id`),
		name: requireString(value.name, `${path}.name`),
		criteria: criteria as SourcingBriefCriteria & Record<string, never>,
		cadence: 'manual',
		isActive: true,
		lastRunAt: value.lastRunAt as string | null,
		createdAt: requireString(value.createdAt, `${path}.createdAt`),
		updatedAt: requireString(value.updatedAt, `${path}.updatedAt`)
	};
}

function parseBriefListEnvelope(value: unknown): SourcingBriefResource[] {
	if (!isRecord(value)) fail('brief list body must be an object');
	if (!Array.isArray(value.data)) fail('brief list data must be an array');
	if (!isRecord(value.meta)) fail('brief list meta must be an object');
	if (value.meta.resource !== 'procurement-briefs') fail('brief list resource is mismatched');
	if (value.meta.namespace !== '/v1/procurement/briefs') fail('brief list namespace is mismatched');
	if (value.meta.version !== 'v1') fail('brief list version is mismatched');

	const briefs = value.data.map((row, index) => parseSourcingBrief(row, `data[${index}]`));
	if (new Set(briefs.map((brief) => brief.id)).size !== briefs.length) {
		fail('brief list contains duplicate ids');
	}
	return briefs;
}

/**
 * List the authenticated caller's active sourcing briefs through Parchment.
 *
 * Parchment owns owner scoping, active filtering, criteria validation, and
 * newest-first ordering. Coffee-app only validates the response envelope and
 * may take a smaller prefix for presentation.
 */
export async function listActiveSourcingBriefs(
	client: ParchmentClient,
	limit?: number
): Promise<SourcingBriefResource[]> {
	const result = (await client.procurement.briefs.list()) as SourcingBriefListResult;
	if (result.error) throw result.error;

	const rows = parseBriefListEnvelope(result.data);
	return limit === undefined ? rows : rows.slice(0, Math.max(0, limit));
}

function parseMatchPage(
	value: unknown,
	expectedPage: number,
	expectedBrief: SourcingBriefResource,
	expectedTotal: number | null,
	expectedBriefFingerprint: string | null
) {
	if (!isRecord(value)) fail(`match page ${expectedPage} body must be an object`);
	if (!Array.isArray(value.data)) fail(`match page ${expectedPage} data must be an array`);
	if (!isRecord(value.pagination)) fail(`match page ${expectedPage} pagination must be an object`);
	if (!isRecord(value.meta)) fail(`match page ${expectedPage} meta must be an object`);

	const pagination = value.pagination;
	const page = requireNonNegativeInteger(pagination.page, 'pagination.page');
	const limit = requireNonNegativeInteger(pagination.limit, 'pagination.limit');
	const total = requireNonNegativeInteger(pagination.total, 'pagination.total');
	const totalPages = requireNonNegativeInteger(pagination.totalPages, 'pagination.totalPages');
	const hasNext = requireBoolean(pagination.hasNext, 'pagination.hasNext');
	const hasPrev = requireBoolean(pagination.hasPrev, 'pagination.hasPrev');
	const calculatedTotalPages = total === 0 ? 0 : Math.ceil(total / MATCH_PAGE_LIMIT);

	if (page !== expectedPage) fail(`expected match page ${expectedPage}, received ${page}`);
	if (limit !== MATCH_PAGE_LIMIT) fail(`match page ${page} limit must be ${MATCH_PAGE_LIMIT}`);
	if (totalPages !== calculatedTotalPages) fail(`match page ${page} totalPages is inconsistent`);
	if (hasNext !== page < totalPages) fail(`match page ${page} hasNext is inconsistent`);
	if (hasPrev !== page > 1) fail(`match page ${page} hasPrev is inconsistent`);
	if (expectedTotal !== null && total !== expectedTotal) fail(`match page ${page} total changed`);
	if (page > Math.max(1, totalPages)) fail(`match page ${page} exceeds totalPages`);

	const expectedRows = total === 0 ? 0 : Math.min(MATCH_PAGE_LIMIT, total - (page - 1) * limit);
	if (value.data.length !== expectedRows) {
		fail(`match page ${page} returned ${value.data.length} rows; expected ${expectedRows}`);
	}
	if (hasNext && value.data.length === 0) fail(`match page ${page} advanced with no rows`);

	if (value.meta.resource !== 'procurement-brief-matches') fail('match resource is mismatched');
	if (value.meta.namespace !== '/v1/procurement/briefs/:id/matches') {
		fail('match namespace is mismatched');
	}
	if (value.meta.version !== 'v1') fail('match version is mismatched');
	if (!Array.isArray(value.meta.limitations)) fail('match limitations must be an array');
	if (!value.meta.limitations.every((item) => typeof item === 'string')) {
		fail('match limitations must contain strings');
	}
	requireString(value.meta.generatedAt, 'meta.generatedAt');

	const brief = parseSourcingBrief(value.meta.brief, 'meta.brief');
	const criteria = parseSourcingBriefCriteria(value.meta.criteria, 'meta.criteria');
	const briefFingerprint = canonicalJson(brief);
	if (brief.id !== expectedBrief.id || briefFingerprint !== canonicalJson(expectedBrief)) {
		fail(`match page ${page} brief metadata is mismatched`);
	}
	if (canonicalJson(criteria) !== canonicalJson(brief.criteria)) {
		fail(`match page ${page} criteria does not match brief metadata`);
	}
	if (expectedBriefFingerprint !== null && briefFingerprint !== expectedBriefFingerprint) {
		fail(`match page ${page} brief metadata changed`);
	}

	const ids = value.data.map((row, index) => {
		if (!isRecord(row)) fail(`match page ${page} data[${index}] must be an object`);
		const id = requireNonNegativeInteger(row.id, `match page ${page} data[${index}].id`);
		if (id === 0) fail(`match page ${page} data[${index}].id must be positive`);
		if (
			!Array.isArray(row.matchReasons) ||
			!row.matchReasons.every((item) => typeof item === 'string')
		) {
			fail(`match page ${page} data[${index}].matchReasons must be a string array`);
		}
		return id;
	});

	return { ids, total, totalPages, hasNext, briefFingerprint };
}

/** Exhaust one canonical sourcing brief's stable match-id set. */
export async function getSourcingBriefMatches(
	client: ParchmentClient,
	brief: SourcingBriefResource
): Promise<SourcingBriefMatchSummary> {
	const matchingIds = new Set<number>();
	const pageFingerprints = new Set<string>();
	let page = 1;
	let total: number | null = null;
	let briefFingerprint: string | null = null;

	while (true) {
		const result = (await client.procurement.briefs.matches(brief.id, {
			page,
			limit: MATCH_PAGE_LIMIT
		})) as SourcingBriefMatchesResult;
		if (result.error) throw result.error;

		const parsed = parseMatchPage(result.data, page, brief, total, briefFingerprint);
		const pageFingerprint = canonicalJson([...parsed.ids].sort((left, right) => left - right));
		if (pageFingerprints.has(pageFingerprint) && parsed.ids.length > 0) {
			fail(`match page ${page} duplicates an earlier page`);
		}
		pageFingerprints.add(pageFingerprint);
		for (const id of parsed.ids) matchingIds.add(id);
		total = parsed.total;
		briefFingerprint = parsed.briefFingerprint;

		if (!parsed.hasNext) break;
		page += 1;
	}

	return {
		briefId: brief.id,
		briefName: brief.name,
		criteria: brief.criteria,
		totalMatchCount: total ?? 0,
		matchingIds: [...matchingIds]
	};
}

/** List active briefs and resolve each brief's complete canonical match-id set. */
export async function getActiveSourcingBriefMatches(
	client: ParchmentClient,
	briefLimit = 10
): Promise<SourcingBriefMatchSummary[]> {
	const briefs = await listActiveSourcingBriefs(client, briefLimit);
	return Promise.all(briefs.map((brief) => getSourcingBriefMatches(client, brief)));
}
