import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Interface for tool input validation
interface CoffeeCatalogToolInput {
	origin?: string;
	process?: string;
	variety?: string;
	price_range?: [number, number];
	flavor_keywords?: string[];
	score_min?: number;
	score_max?: number;
	limit?: number;
	stocked_only?: boolean;
}

// Tool response interface
interface CoffeeCatalogToolResponse {
	coffees: any[];
	total: number;
	filters_applied: CoffeeCatalogToolInput;
	search_strategy: 'structured' | 'hybrid' | 'fallback';
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: CoffeeCatalogToolInput = await event.request.json();

		// Default parameters
		const {
			origin,
			process,
			variety,
			price_range,
			flavor_keywords = [],
			score_min,
			score_max,
			limit = 10,
			stocked_only = true
		} = input;

		// Build query
		let query = supabase.from('coffee_catalog').select('*').eq('public_coffee', true);

		// Apply stocked filter
		if (stocked_only) {
			query = query.eq('stocked', true);
		}

		// Apply structured filters
		if (origin) {
			// Check continent, country, and region
			query = query.or(
				`continent.ilike.%${origin}%,country.ilike.%${origin}%,region.ilike.%${origin}%`
			);
		}

		if (process) {
			query = query.ilike('processing', `%${process}%`);
		}

		if (variety) {
			query = query.ilike('cultivar_detail', `%${variety}%`);
		}

		if (price_range && price_range.length === 2) {
			query = query.gte('cost_lb', price_range[0]).lte('cost_lb', price_range[1]);
		}

		if (score_min) {
			query = query.gte('score_value', score_min);
		}

		if (score_max) {
			query = query.lte('score_value', score_max);
		}

		// Apply flavor keywords to multiple text fields
		if (flavor_keywords.length > 0) {
			const flavorConditions = flavor_keywords
				.map((keyword) => {
					return `ai_description.ilike.%${keyword}%,cupping_notes.ilike.%${keyword}%,farm_notes.ilike.%${keyword}%`;
				})
				.join(',');
			query = query.or(flavorConditions);
		}

		// Apply limit and ordering
		query = query.order('score_value', { ascending: false }).limit(limit);

		const { data: coffees, error } = await query;

		if (error) {
			console.error('Coffee catalog tool error:', error);
			return json({ error: 'Failed to search coffee catalog' }, { status: 500 });
		}

		// Determine search strategy used
		let searchStrategy: 'structured' | 'hybrid' | 'fallback' = 'structured';

		// If no results with strict filters, could implement fallback logic here
		if (!coffees || coffees.length === 0) {
			searchStrategy = 'fallback';
		}

		const response: CoffeeCatalogToolResponse = {
			coffees: coffees || [],
			total: coffees?.length || 0,
			filters_applied: {
				origin,
				process,
				variety,
				price_range,
				flavor_keywords,
				score_min,
				score_max,
				limit,
				stocked_only
			},
			search_strategy: searchStrategy
		};

		return json(response);
	} catch (error) {
		console.error('Coffee catalog tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
