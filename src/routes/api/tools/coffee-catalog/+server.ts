/**
 * @deprecated This endpoint is kept for backward compatibility only.
 * The chat agent now calls @purveyors/cli searchCatalog() directly.
 * Do not add new consumers — use the CLI library instead.
 */
import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { searchCatalog } from '$lib/data/catalog';

// Interface for tool input validation
interface CoffeeCatalogToolInput {
	origin?: string;
	process?: string;
	variety?: string;
	price_range?: [number, number];
	flavor_keywords?: string[];

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
	coffees: Record<string, unknown>[];
	total: number;
	filters_applied: CoffeeCatalogToolInput;
	search_strategy: 'structured' | 'hybrid' | 'fallback';
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: CoffeeCatalogToolInput = await event.request.json();

		// Default parameters
		const {
			origin,
			process,
			variety,
			price_range,
			flavor_keywords = [],

			limit = 10,
			stocked_only = true,
			name,
			stocked_days,
			drying_method,
			supplier,
			coffee_ids
		} = input;

		// Enforce maximum of 15 items
		const finalLimit = Math.min(limit || 10, 15);

		const result = await searchCatalog(supabase, {
			origin,
			process,
			variety,
			priceRange: price_range,
			flavorKeywords: flavor_keywords,
			name,
			stockedDays: stocked_days,
			dryingMethod: drying_method,
			supplier,
			coffeeIds: coffee_ids,
			stockedOnly: stocked_only !== false,
			publicOnly: true,
			limit: finalLimit,
			orderBy: 'stocked_date',
			orderDirection: 'desc'
		});

		// Determine search strategy used
		let searchStrategy: 'structured' | 'hybrid' | 'fallback' = 'structured';
		if (!result.data || result.data.length === 0) {
			searchStrategy = 'fallback';
		}

		// Strip score_value from results — cupping scores are noise for the chat model
		const sanitizedCoffees = result.data.map(({ score_value: _score_value, ...rest }) => rest);

		const response: CoffeeCatalogToolResponse = {
			coffees: sanitizedCoffees as Record<string, unknown>[],
			total: result.data.length,
			filters_applied: {
				origin,
				process,
				variety,
				price_range,
				flavor_keywords,

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
