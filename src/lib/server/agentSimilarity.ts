import { createAdminClient } from '$lib/supabase-admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	DEFAULT_CATALOG_SIMILARITY_LIMIT,
	DEFAULT_CATALOG_SIMILARITY_THRESHOLD,
	MAX_CATALOG_SIMILARITY_LIMIT,
	MAX_CATALOG_SIMILARITY_THRESHOLD,
	MIN_CATALOG_SIMILARITY_THRESHOLD,
	fetchCatalogSimilarityMatches,
	type CatalogSimilarityMatch
} from '$lib/server/catalogSimilarity';

/**
 * Similarity reader for the chat agent's find_similar_beans tool.
 *
 * The bounded v2/v3 similarity RPCs revoke EXECUTE from anon/authenticated
 * (only service_role may call them), so this must use the admin client. The
 * legacy CLI path called the unbounded v1 RPC on the user-scoped client,
 * which now exceeds the Postgres statement timeout as coffee_chunks has
 * grown. Entitlement is enforced upstream: the tool is only registered for
 * authenticated chat sessions.
 */

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
	client: SupabaseClient = createAdminClient()
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

	const result = await fetchCatalogSimilarityMatches({
		supabase: client,
		coffeeId: input.coffee_id,
		query: { threshold, limit, stockedOnly: true, mode: 'all' },
		publicOnly: false
	});

	return {
		target: {
			coffee_id: result.target.id,
			coffee_name: result.target.name,
			source: result.target.source,
			origin: result.target.origin,
			country: result.target.country,
			processing: result.target.processing
		},
		matches: result.matches.map(toAgentSimilarBean),
		total: result.matches.length,
		query_strategy: result.queryStrategy
	};
}
