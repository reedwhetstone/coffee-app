import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApiPlan } from '$lib/server/apiAuth';
import type { Json } from '$lib/types/database.types';
import type { UserRole } from '$lib/types/auth.types';
import {
	createCatalogProofSummary,
	type CatalogProofInput,
	type CatalogProofSummary
} from '$lib/catalog/proofSummary';

export type CatalogSimilarityMode = 'all' | 'likely_same' | 'similar_profile';
export type CatalogMatchCategory = 'likely_same' | 'similar_profile';
export type CatalogMatchConfidenceLabel = 'high_beta' | 'medium_beta' | 'low_beta';

export interface CatalogSimilarityQuery {
	threshold: number;
	limit: number;
	stockedOnly: boolean;
	mode: CatalogSimilarityMode;
}

export interface CatalogSimilarityTargetSummary {
	id: number;
	name: string;
	source: string | null;
	origin: string | null;
	country: string | null;
	continent: string | null;
	processing: string | null;
	processing_base_method: string | null;
	fermentation_type: string | null;
	drying_method: string | null;
	stocked: boolean | null;
	arrival_date: string | null;
	stocked_date: string | null;
	price_per_lb: number | null;
	price_tiers: Json | null;
	cost_lb: number | null;
	pricing: CatalogCanonicalPricing;
	proof: CatalogProofSummary;
}

export interface CatalogCanonicalPricing {
	price_per_lb: number | null;
	price_tiers: Json | null;
	cost_lb: number | null;
	baseline_quantity_lbs: 1;
	baseline_price_per_lb: number | null;
	baseline_source: 'price_per_lb' | 'price_tiers' | 'cost_lb' | null;
}

export interface CatalogSimilarityMatch {
	coffee: {
		id: number;
		name: string;
		source: string | null;
		origin: string | null;
		country: string | null;
		continent: string | null;
		processing: string | null;
		processing_base_method: string | null;
		fermentation_type: string | null;
		drying_method: string | null;
		stocked: boolean | null;
		arrival_date: string | null;
		stocked_date: string | null;
		proof: CatalogProofSummary;
	};
	pricing: CatalogCanonicalPricing;
	price_delta_1lb: {
		amount: number | null;
		percent: number | null;
		currency: 'USD';
	};
	score: {
		average: number;
		dimensions: {
			origin: number | null;
			processing: number | null;
			tasting: number | null;
		};
		chunk_matches: number;
	};
	match: {
		category: CatalogMatchCategory;
		confidence: CatalogMatchConfidenceLabel;
		beta: true;
		language: string;
	};
	explanation: {
		summary: string;
		signals: string[];
	};
	compatibility: {
		cost_lb: number | null;
	};
}

export interface CatalogSimilarityResponse {
	data: {
		target: CatalogSimilarityTargetSummary;
		matches: CatalogSimilarityMatch[];
	};
	meta: {
		resource: 'catalog-similarity';
		namespace: '/v1/catalog/{id}/similar';
		version: 'v1';
		status: 'beta';
		auth: {
			kind: 'session' | 'api-key';
			role: UserRole | null;
			apiPlan: ApiPlan | null;
		};
		access: {
			requiredCapability: 'canUseBeanMatching';
			canUseBeanMatching: true;
		};
		query: CatalogSimilarityQuery;
		copy: {
			confidence: string;
		};
	};
}

export class CatalogSimilarityValidationError extends Error {
	constructor(
		public parameter: string,
		public value: string,
		public expected: string
	) {
		super(`Query parameter "${parameter}" must use ${expected}`);
		this.name = 'CatalogSimilarityValidationError';
	}
}

export class CatalogSimilarityNotFoundError extends Error {
	constructor(public coffeeId: number) {
		super(`Catalog coffee ${coffeeId} was not found`);
		this.name = 'CatalogSimilarityNotFoundError';
	}
}

export interface FindSimilarBeansAggregatedV2Row {
	coffee_id: number;
	coffee_name: string;
	source: string | null;
	origin: string | null;
	country: string | null;
	continent: string | null;
	processing: string | null;
	processing_base_method: string | null;
	fermentation_type: string | null;
	drying_method: string | null;
	cost_lb: number | string | null;
	price_per_lb: number | string | null;
	price_tiers: Json | null;
	stocked: boolean | null;
	avg_similarity: number | string;
	origin_similarity: number | string | null;
	processing_similarity: number | string | null;
	tasting_similarity: number | string | null;
	chunk_matches: number | string;
}

interface CatalogSimilarityProofFields {
	arrival_date: string | null;
	stocked_date: string | null;
	last_updated: string | null;
	farm_notes: string | null;
	wholesale: boolean | null;
	process_additives: string[] | null;
	process_additive_detail: string | null;
	fermentation_duration_hours: number | null;
	processing_notes: string | null;
	processing_disclosure_level: string | null;
	processing_confidence: number | null;
	processing_evidence_available: boolean | null;
}

interface CatalogSimilarityTargetRow extends CatalogSimilarityProofFields {
	id: number;
	name: string;
	source: string | null;
	region: string | null;
	country: string | null;
	continent: string | null;
	processing: string | null;
	processing_base_method: string | null;
	fermentation_type: string | null;
	drying_method: string | null;
	stocked: boolean | null;
	cost_lb: number | string | null;
	price_per_lb: number | string | null;
	price_tiers: Json | null;
}

type CatalogSimilarityDetailRow = CatalogSimilarityTargetRow;

interface SimilaritySupabaseClient {
	from(table: 'coffee_catalog'): {
		select(columns: string): {
			eq(
				column: 'id',
				value: number
			): {
				maybeSingle(): Promise<{
					data: CatalogSimilarityTargetRow | null;
					error: { message: string } | null;
				}>;
			};
			in(
				column: 'id',
				values: number[]
			): Promise<{ data: CatalogSimilarityDetailRow[] | null; error: { message: string } | null }>;
		};
	};
	rpc(
		fn: 'find_similar_beans_aggregated_v2',
		args: {
			target_coffee_id: number;
			match_threshold: number;
			match_count: number | null;
			stocked_only: boolean;
		}
	): Promise<{ data: FindSimilarBeansAggregatedV2Row[] | null; error: { message: string } | null }>;
	rpc(
		fn: 'count_similar_beans_aggregated_v2',
		args: {
			target_coffee_id: number;
			match_threshold: number;
			stocked_only: boolean;
		}
	): Promise<{ data: number | null; error: { message: string } | null }>;
}

const TARGET_SELECT =
	'id, name, source, region, country, continent, processing, processing_base_method, fermentation_type, drying_method, stocked, arrival_date, stocked_date, last_updated, farm_notes, wholesale, process_additives, process_additive_detail, fermentation_duration_hours, processing_notes, processing_disclosure_level, processing_confidence, processing_evidence_available, cost_lb, price_per_lb, price_tiers';
export const DEFAULT_CATALOG_SIMILARITY_THRESHOLD = 0.7;
export const DEFAULT_CATALOG_SIMILARITY_LIMIT = 10;
export const MAX_CATALOG_SIMILARITY_LIMIT = 25;
const MODE_FILTER_OVERFETCH_MULTIPLIER = 5;
const MODE_FILTER_RPC_MATCH_LIMIT = MAX_CATALOG_SIMILARITY_LIMIT * MODE_FILTER_OVERFETCH_MULTIPLIER;
export const MIN_CATALOG_SIMILARITY_THRESHOLD = 0.5;
export const MAX_CATALOG_SIMILARITY_THRESHOLD = 0.99;

function toFiniteNumber(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

function roundScore(value: number | null): number | null {
	if (value === null) return null;
	return Math.round(value * 1000) / 1000;
}

function parseBooleanParam(value: string | null, parameter: string, fallback: boolean): boolean {
	if (value === null) return fallback;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new CatalogSimilarityValidationError(parameter, value, 'true or false');
}

function parsePositiveIntParam(value: string | null, parameter: string, fallback: number): number {
	if (value === null) return fallback;
	if (!/^\d+$/.test(value)) {
		throw new CatalogSimilarityValidationError(parameter, value, 'positive integer');
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_CATALOG_SIMILARITY_LIMIT) {
		throw new CatalogSimilarityValidationError(
			parameter,
			value,
			`positive integer less than or equal to ${MAX_CATALOG_SIMILARITY_LIMIT}`
		);
	}
	return parsed;
}

function parseThresholdParam(value: string | null): number {
	if (value === null) return DEFAULT_CATALOG_SIMILARITY_THRESHOLD;
	const trimmed = value.trim();
	if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
		throw new CatalogSimilarityValidationError('threshold', value, 'number between 0.5 and 0.99');
	}
	const parsed = Number.parseFloat(trimmed);
	if (
		!Number.isFinite(parsed) ||
		parsed < MIN_CATALOG_SIMILARITY_THRESHOLD ||
		parsed > MAX_CATALOG_SIMILARITY_THRESHOLD
	) {
		throw new CatalogSimilarityValidationError('threshold', value, 'number between 0.5 and 0.99');
	}
	return parsed;
}

function parseModeParam(value: string | null): CatalogSimilarityMode {
	if (value === null || value === '') return 'all';
	if (value === 'all' || value === 'likely_same' || value === 'similar_profile') return value;
	throw new CatalogSimilarityValidationError('mode', value, 'all, likely_same, or similar_profile');
}

export function parseCatalogSimilarityQuery(url: URL): CatalogSimilarityQuery {
	return {
		threshold: parseThresholdParam(url.searchParams.get('threshold')),
		limit: parsePositiveIntParam(
			url.searchParams.get('limit'),
			'limit',
			DEFAULT_CATALOG_SIMILARITY_LIMIT
		),
		stockedOnly: parseBooleanParam(url.searchParams.get('stocked_only'), 'stocked_only', true),
		mode: parseModeParam(url.searchParams.get('mode'))
	};
}

function tierRecord(value: Json): { min_lbs: number | null; price: number | null } | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, Json | undefined>;
	const min = toFiniteNumber(
		(record.min_lbs ?? record.minLbs ?? record.quantity_lbs) as number | string
	);
	const price = toFiniteNumber((record.price ?? record.price_per_lb) as number | string);
	return price === null ? null : { min_lbs: min, price };
}

export function getPriceFromTiersAtQuantity(
	priceTiers: Json | null,
	quantityLbs = 1
): number | null {
	if (!Array.isArray(priceTiers)) return null;
	const tiers = priceTiers
		.map(tierRecord)
		.filter((tier): tier is { min_lbs: number | null; price: number } => tier !== null)
		.sort((a, b) => (a.min_lbs ?? 0) - (b.min_lbs ?? 0));

	if (tiers.length === 0) return null;

	const eligible = tiers.filter((tier) => (tier.min_lbs ?? 0) <= quantityLbs);
	const selected = eligible.at(-1);
	return selected?.price ?? null;
}

export function normalizeCanonicalPricing(input: {
	price_per_lb: number | string | null;
	price_tiers: Json | null;
	cost_lb: number | string | null;
}): CatalogCanonicalPricing {
	const pricePerLb = toFiniteNumber(input.price_per_lb);
	const tierOnePrice = getPriceFromTiersAtQuantity(input.price_tiers, 1);
	const costLb = toFiniteNumber(input.cost_lb);
	const baselinePrice = pricePerLb ?? tierOnePrice ?? costLb;
	const baselineSource =
		pricePerLb !== null
			? 'price_per_lb'
			: tierOnePrice !== null
				? 'price_tiers'
				: costLb !== null
					? 'cost_lb'
					: null;

	return {
		price_per_lb: pricePerLb,
		price_tiers: input.price_tiers,
		cost_lb: costLb,
		baseline_quantity_lbs: 1,
		baseline_price_per_lb: baselinePrice,
		baseline_source: baselineSource
	};
}

export function deriveMatchCategory(input: {
	average: number;
	origin: number | null;
	processing: number | null;
	chunkMatches: number;
}): CatalogMatchCategory {
	if (
		input.average >= 0.88 &&
		input.chunkMatches >= 2 &&
		(input.origin === null || input.origin >= 0.84) &&
		(input.processing === null || input.processing >= 0.84)
	) {
		return 'likely_same';
	}
	return 'similar_profile';
}

export function deriveConfidenceLabel(score: number): CatalogMatchConfidenceLabel {
	if (score >= 0.9) return 'high_beta';
	if (score >= 0.8) return 'medium_beta';
	return 'low_beta';
}

function confidenceLanguage(
	category: CatalogMatchCategory,
	confidence: CatalogMatchConfidenceLabel
): string {
	if (category === 'likely_same') {
		return confidence === 'high_beta'
			? 'High beta confidence likely same coffee candidate. Review supplier details before acting.'
			: 'Beta likely same coffee candidate. Treat as a strong lead, not a canonical identity.';
	}
	return 'Beta similar profile candidate. Useful for substitution research, not an identity claim.';
}

function buildSignals(row: FindSimilarBeansAggregatedV2Row): string[] {
	const signals: string[] = [];
	const origin = roundScore(toFiniteNumber(row.origin_similarity));
	const processing = roundScore(toFiniteNumber(row.processing_similarity));
	const tasting = roundScore(toFiniteNumber(row.tasting_similarity));
	if (origin !== null) signals.push(`Origin similarity ${origin}`);
	if (processing !== null) signals.push(`Processing similarity ${processing}`);
	if (tasting !== null) signals.push(`Tasting similarity ${tasting}`);
	if (signals.length === 0) signals.push('Similarity is based on available embedding chunks.');
	return signals;
}

function proofInputFromSimilarityRow(
	row: FindSimilarBeansAggregatedV2Row | CatalogSimilarityTargetRow,
	pricing: CatalogCanonicalPricing
): CatalogProofInput {
	const hasProofFields = 'arrival_date' in row;
	return {
		country: row.country,
		region: 'region' in row ? row.region : row.origin,
		farm_notes: hasProofFields ? row.farm_notes : null,
		source: row.source,
		arrival_date: hasProofFields ? row.arrival_date : null,
		stocked_date: hasProofFields ? row.stocked_date : null,
		last_updated: hasProofFields ? row.last_updated : null,
		stocked: row.stocked,
		price_per_lb: pricing.price_per_lb,
		cost_lb: pricing.cost_lb,
		price_tiers: pricing.price_tiers,
		wholesale: hasProofFields ? row.wholesale : null,
		processing_base_method: row.processing_base_method,
		fermentation_type: row.fermentation_type,
		process_additives: hasProofFields ? row.process_additives : null,
		process_additive_detail: hasProofFields ? row.process_additive_detail : null,
		fermentation_duration_hours: hasProofFields ? row.fermentation_duration_hours : null,
		drying_method: row.drying_method,
		processing_notes: hasProofFields ? row.processing_notes : null,
		processing_disclosure_level: hasProofFields ? row.processing_disclosure_level : null,
		processing_confidence: hasProofFields ? row.processing_confidence : null,
		processing_evidence_available: hasProofFields ? row.processing_evidence_available : null
	};
}

export function normalizeSimilarityRow(
	row: FindSimilarBeansAggregatedV2Row,
	targetPricing: CatalogCanonicalPricing,
	detail?: CatalogSimilarityDetailRow
): CatalogSimilarityMatch {
	const rawAverage = toFiniteNumber(row.avg_similarity) ?? 0;
	const rawOrigin = toFiniteNumber(row.origin_similarity);
	const rawProcessing = toFiniteNumber(row.processing_similarity);
	const rawTasting = toFiniteNumber(row.tasting_similarity);
	const average = roundScore(rawAverage) ?? 0;
	const origin = roundScore(rawOrigin);
	const processing = roundScore(rawProcessing);
	const tasting = roundScore(rawTasting);
	const chunkMatches = Math.trunc(toFiniteNumber(row.chunk_matches) ?? 0);
	const category = deriveMatchCategory({
		average: rawAverage,
		origin: rawOrigin,
		processing: rawProcessing,
		chunkMatches
	});
	const confidence = deriveConfidenceLabel(rawAverage);
	const pricing = normalizeCanonicalPricing(detail ?? row);
	const targetBaseline = targetPricing.baseline_price_per_lb;
	const matchBaseline = pricing.baseline_price_per_lb;
	const deltaAmount =
		targetBaseline !== null && matchBaseline !== null
			? roundCurrency(matchBaseline - targetBaseline)
			: null;
	const deltaPercent =
		deltaAmount !== null && targetBaseline !== null && targetBaseline > 0
			? Math.round((deltaAmount / targetBaseline) * 1000) / 10
			: null;

	const proofSource = detail ?? row;
	return {
		coffee: {
			id: row.coffee_id,
			name: detail?.name ?? row.coffee_name,
			source: detail?.source ?? row.source,
			origin: detail?.region ?? row.origin,
			country: detail?.country ?? row.country,
			continent: detail?.continent ?? row.continent,
			processing: detail?.processing ?? row.processing,
			processing_base_method: detail?.processing_base_method ?? row.processing_base_method,
			fermentation_type: detail?.fermentation_type ?? row.fermentation_type,
			drying_method: detail?.drying_method ?? row.drying_method,
			stocked: detail?.stocked ?? row.stocked,
			arrival_date: detail?.arrival_date ?? null,
			stocked_date: detail?.stocked_date ?? null,
			proof: createCatalogProofSummary(proofInputFromSimilarityRow(proofSource, pricing))
		},
		pricing,
		price_delta_1lb: {
			amount: deltaAmount,
			percent: deltaPercent,
			currency: 'USD'
		},
		score: {
			average,
			dimensions: { origin, processing, tasting },
			chunk_matches: chunkMatches
		},
		match: {
			category,
			confidence,
			beta: true,
			language: confidenceLanguage(category, confidence)
		},
		explanation: {
			summary:
				'Beta similarity score based on available origin, processing, and tasting embeddings.',
			signals: buildSignals(row)
		},
		compatibility: {
			cost_lb: pricing.cost_lb
		}
	};
}

function matchesMode(match: CatalogSimilarityMatch, mode: CatalogSimilarityMode): boolean {
	if (mode === 'all') return true;
	return match.match.category === mode;
}

function resolveRpcMatchCount(query: CatalogSimilarityQuery): number {
	if (query.mode === 'all') return query.limit;
	return MODE_FILTER_RPC_MATCH_LIMIT;
}

function toTargetSummary(row: CatalogSimilarityTargetRow): CatalogSimilarityTargetSummary {
	const pricing = normalizeCanonicalPricing(row);
	return {
		id: row.id,
		name: row.name,
		source: row.source,
		origin: row.region,
		country: row.country,
		continent: row.continent,
		processing: row.processing,
		processing_base_method: row.processing_base_method,
		fermentation_type: row.fermentation_type,
		drying_method: row.drying_method,
		stocked: row.stocked,
		arrival_date: row.arrival_date,
		stocked_date: row.stocked_date,
		price_per_lb: pricing.price_per_lb,
		price_tiers: pricing.price_tiers,
		cost_lb: pricing.cost_lb,
		pricing,
		proof: createCatalogProofSummary(proofInputFromSimilarityRow(row, pricing))
	};
}

async function fetchTarget(
	supabase: SimilaritySupabaseClient,
	coffeeId: number
): Promise<CatalogSimilarityTargetSummary> {
	const { data, error } = await supabase
		.from('coffee_catalog')
		.select(TARGET_SELECT)
		.eq('id', coffeeId)
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!data) throw new CatalogSimilarityNotFoundError(coffeeId);
	return toTargetSummary(data);
}

async function fetchMatchDetails(
	supabase: SimilaritySupabaseClient,
	coffeeIds: number[]
): Promise<Map<number, CatalogSimilarityDetailRow>> {
	if (coffeeIds.length === 0) return new Map();
	const uniqueIds = [...new Set(coffeeIds)];
	const { data, error } = await supabase
		.from('coffee_catalog')
		.select(TARGET_SELECT)
		.in('id', uniqueIds);

	if (error) throw new Error(error.message);
	return new Map((data ?? []).map((row) => [row.id, row]));
}

export async function fetchCatalogSimilarityMatches(input: {
	supabase: SupabaseClient;
	coffeeId: number;
	query: CatalogSimilarityQuery;
}): Promise<{ target: CatalogSimilarityTargetSummary; matches: CatalogSimilarityMatch[] }> {
	const supabase = input.supabase as unknown as SimilaritySupabaseClient;
	const target = await fetchTarget(supabase, input.coffeeId);
	const rpcMatchCount = resolveRpcMatchCount(input.query);
	const { data, error } = await supabase.rpc('find_similar_beans_aggregated_v2', {
		target_coffee_id: input.coffeeId,
		match_threshold: input.query.threshold,
		match_count: rpcMatchCount,
		stocked_only: input.query.stockedOnly
	});

	if (error) throw new Error(error.message);

	const detailById = await fetchMatchDetails(
		supabase,
		(data ?? []).map((row) => row.coffee_id)
	);
	const matches = (data ?? [])
		.map((row) => normalizeSimilarityRow(row, target.pricing, detailById.get(row.coffee_id)))
		.filter((match) => matchesMode(match, input.query.mode))
		.slice(0, input.query.limit);

	return { target, matches };
}

export async function countCatalogSimilarityMatches(input: {
	supabase: SupabaseClient;
	coffeeId: number;
	query: Pick<CatalogSimilarityQuery, 'threshold' | 'stockedOnly'>;
}): Promise<number> {
	const supabase = input.supabase as unknown as SimilaritySupabaseClient;
	await fetchTarget(supabase, input.coffeeId);
	const { data, error } = await supabase.rpc('count_similar_beans_aggregated_v2', {
		target_coffee_id: input.coffeeId,
		match_threshold: input.query.threshold,
		stocked_only: input.query.stockedOnly
	});

	if (error) throw new Error(error.message);
	return Math.max(0, Math.trunc(toFiniteNumber(data) ?? 0));
}
