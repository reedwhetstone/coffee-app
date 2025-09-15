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
	// New search parameters
	name?: string;
	stocked_days?: number;
	drying_method?: string;
	supplier?: string;
	coffee_ids?: number[];
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
			stocked_only = true,
			name,
			stocked_days,
			drying_method,
			supplier,
			coffee_ids
		} = input;

		// Build query
		let query = supabase.from('coffee_catalog').select('*').eq('public_coffee', true);

		// Apply stocked filter - default to stocked coffees unless explicitly disabled
		// This keeps results focused on currently available inventory
		if (stocked_only !== false) {
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

		// New search parameters
		if (name) {
			query = query.ilike('name', `%${name}%`);
		}

		if (drying_method) {
			// Search both processing and drying_method fields
			query = query.or(
				`processing.ilike.%${drying_method}%,drying_method.ilike.%${drying_method}%`
			);
		}

		if (supplier) {
			query = query.ilike('source', `%${supplier}%`);
		}

		if (coffee_ids && coffee_ids.length > 0) {
			query = query.in('id', coffee_ids);
		}

		if (stocked_days && stocked_days > 0) {
			// Calculate date N days ago
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - stocked_days);
			const cutoffISOString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
			query = query.gte('stocked_date', cutoffISOString);
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
			// Build OR conditions for each keyword across all searchable text fields
			const allFieldConditions: string[] = [];

			for (const keyword of flavor_keywords) {
				// Add conditions for each text field from the schema
				allFieldConditions.push(`description_short.ilike.%${keyword}%`);
				allFieldConditions.push(`description_long.ilike.%${keyword}%`);
				allFieldConditions.push(`farm_notes.ilike.%${keyword}%`);
				allFieldConditions.push(`ai_description.ilike.%${keyword}%`);
				allFieldConditions.push(`cupping_notes.ilike.%${keyword}%`);
			}

			// Apply all conditions as a single OR query
			query = query.or(allFieldConditions.join(','));
		}

		// Apply limit and ordering - enforce maximum of 15 items
		const finalLimit = Math.min(limit || 10, 15);
		query = query.order('score_value', { ascending: false }).limit(finalLimit);

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
				limit: finalLimit,
				stocked_only,
				name,
				stocked_days,
				drying_method,
				supplier,
				coffee_ids
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
