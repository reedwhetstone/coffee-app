import type { ParchmentClient, components } from '@purveyors/sdk';

/**
 * Similarity reader for the chat agent's find_similar_beans tool.
 *
 * Parchment owns retrieval, classification, row projection, and entitlement.
 * The chat route supplies its request-bound session client so member access is
 * enforced by the same contract used by the catalog comparison BFF and SDK.
 */

type CatalogSimilarityMatch = components['schemas']['CatalogSimilarityMatch'];

const DEFAULT_CATALOG_SIMILARITY_LIMIT = 8;
const DEFAULT_CATALOG_SIMILARITY_THRESHOLD = 0.72;
const MAX_CATALOG_SIMILARITY_LIMIT = 15;
const MAX_CATALOG_SIMILARITY_THRESHOLD = 0.95;
const MIN_CATALOG_SIMILARITY_THRESHOLD = 0.5;

export interface AgentSimilarityInput {
	coffee_id: number;
	threshold?: number;
	limit?: number;
}

export interface AgentSimilarBean {
	coffee_id: number;
	coffee_name: string;
	source: string | null;
	origin: string | null;
	country: string | null;
	processing: string | null;
	stocked: boolean | null;
	price_per_lb_1lb_baseline: number | null;
	price_delta_vs_target: number | null;
	avg_similarity: number;
	origin_similarity: number | null;
	processing_similarity: number | null;
	tasting_similarity: number | null;
	chunk_matches: number;
	match_category: string;
	match_confidence: string;
}

export interface AgentSimilarityResult {
	target: {
		coffee_id: number;
		coffee_name: string;
		source: string | null;
		origin: string | null;
		country: string | null;
		processing: string | null;
	};
	matches: AgentSimilarBean[];
	total: number;
	query_strategy: string;
}

export type AgentSimilarityReader = (input: AgentSimilarityInput) => Promise<AgentSimilarityResult>;

function formatParchmentError(error: unknown): string {
	if (typeof error !== 'object' || error === null) return 'unknown Parchment error';

	const envelope = error as {
		message?: unknown;
		error?: unknown;
	};
	if (typeof envelope.message === 'string') return envelope.message;
	if (typeof envelope.error === 'string') return envelope.error;
	if (
		typeof envelope.error === 'object' &&
		envelope.error !== null &&
		'message' in envelope.error &&
		typeof envelope.error.message === 'string'
	) {
		return envelope.error.message;
	}
	return 'unknown Parchment error';
}

function toAgentSimilarBean(match: CatalogSimilarityMatch): AgentSimilarBean {
	return {
		coffee_id: match.coffee.id,
		coffee_name: match.coffee.name,
		source: match.coffee.source,
		origin: match.coffee.origin,
		country: match.coffee.country,
		processing: match.coffee.processing,
		stocked: match.coffee.stocked,
		price_per_lb_1lb_baseline: match.pricing.baseline_price_per_lb,
		price_delta_vs_target: match.price_delta_1lb.amount,
		avg_similarity: match.score.average,
		origin_similarity: match.score.dimensions.origin,
		processing_similarity: match.score.dimensions.processing,
		tasting_similarity: match.score.dimensions.tasting,
		chunk_matches: match.score.chunk_matches,
		match_category: match.match.category,
		match_confidence: match.match.confidence
	};
}

export async function findSimilarBeansForAgent(
	input: AgentSimilarityInput,
	client: ParchmentClient
): Promise<AgentSimilarityResult> {
	const threshold = Math.min(
		Math.max(
			input.threshold ?? DEFAULT_CATALOG_SIMILARITY_THRESHOLD,
			MIN_CATALOG_SIMILARITY_THRESHOLD
		),
		MAX_CATALOG_SIMILARITY_THRESHOLD
	);
	const limit = Math.min(
		Math.max(input.limit ?? DEFAULT_CATALOG_SIMILARITY_LIMIT, 1),
		MAX_CATALOG_SIMILARITY_LIMIT
	);

	const { data, error } = await client.catalog.similar(String(input.coffee_id), {
		threshold: String(threshold),
		limit,
		stocked_only: 'true',
		mode: 'all'
	});
	if (error) {
		throw new Error(`Parchment catalog similarity query failed: ${formatParchmentError(error)}`);
	}
	if (!data) throw new Error('Parchment catalog similarity query returned no data');

	return {
		target: {
			coffee_id: data.data.target.id,
			coffee_name: data.data.target.name,
			source: data.data.target.source,
			origin: data.data.target.origin,
			country: data.data.target.country,
			processing: data.data.target.processing
		},
		matches: data.data.matches.map(toAgentSimilarBean),
		total: data.data.matches.length,
		query_strategy: data.meta.query_strategy
	};
}
