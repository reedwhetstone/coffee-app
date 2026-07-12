import { tool } from 'ai';
import type { JSONValue } from 'ai';
import { z } from 'zod';
import type { ParchmentClient } from '@purveyors/sdk';
import {
	CATALOG_FACET_FIELDS,
	RANK_OBJECTIVES,
	getCatalogFacets,
	getSupplierList,
	rankCatalog,
	type MarketToolsClient
} from '$lib/services/marketTools';
import { compactCatalogSearchOutputForModel } from '$lib/services/toolModelOutput';
import type { ChatToolAccess, ChatToolDeps } from './shared';

export function createCatalogTools(
	client: ParchmentClient,
	access: ChatToolAccess,
	deps: ChatToolDeps
) {
	const marketClient = client as unknown as MarketToolsClient;

	return {
		coffee_catalog_search: tool({
			description:
				'Search for coffee beans in the catalog with filters for origin, processing, variety, price range, flavor keywords, coffee name, recent arrivals, supplier, and specific coffee IDs',
			inputSchema: z.object({
				origin: z.string().optional().describe('Coffee origin (country, region, or continent)'),
				process: z.string().optional().describe('Processing method (natural, washed, honey, etc.)'),
				variety: z.string().optional().describe('Coffee variety/cultivar'),
				price_range: z.array(z.number()).length(2).optional().describe('Price range [min, max]'),
				flavor_keywords: z.array(z.string()).optional().describe('Flavor descriptors'),

				limit: z.number().optional().default(10).describe('Number of results to return (max 15)'),
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						'Only show currently stocked coffees (default: true, use false for historical analysis)'
					),
				name: z.string().optional().describe('Search by coffee name'),
				stocked_days: z.number().optional().describe('Find coffees stocked within this many days'),
				drying_method: z
					.string()
					.optional()
					.describe('Drying method (sun-dried, patio-dried, etc.)'),
				supplier: z.string().optional().describe('Coffee supplier or source'),
				coffee_ids: z.array(z.number()).optional().describe('Specific coffee IDs to retrieve')
			}),
			execute: async (input) => {
				if (deps.searchCatalog) {
					const coffees = await deps.searchCatalog({
						...input,
						price_range: input.price_range as [number, number] | undefined
					});
					return {
						coffees,
						total: coffees.length,
						filters_applied: input,
						search_strategy: 'structured' as const
					};
				}

				// Runtime callers inject the canonical session-mode Parchment catalog reader.
				// name, supplier, ids are now natively supported by the CLI (v0.8.3+).
				// Remaining client-side filters: variety, stocked_days, drying_method.
				throw new Error('Session-mode catalog reader is unavailable');
			},
			// Full rows stream to the client for cards; the model sees a compact
			// view (long prose dropped/truncated) to keep token cost flat.
			toModelOutput: ({ output }) => ({
				type: 'json',
				value: compactCatalogSearchOutputForModel(output) as JSONValue
			})
		}),

		find_similar_beans: tool({
			description:
				'Find beans similar to a specific coffee across all suppliers. Uses embedding similarity on origin, processing, and tasting profiles. Returns ranked matches with similarity scores.',
			inputSchema: z.object({
				coffee_id: z.number(),
				threshold: z.number().optional(),
				limit: z.number().optional()
			}),
			execute: async (input) => {
				// CLI schema field names match execute params (coffee_id, threshold, limit).
				if (!input.coffee_id || input.coffee_id <= 0) {
					return {
						error:
							'coffee_id is required and must be a positive integer. Please specify which coffee to find similar beans for.'
					};
				}
				// The bounded v3 similarity RPC is service_role-only, so the server
				// injects a reader backed by the admin client. The CLI path is a
				// fallback for callers that construct tools without deps.
				if (deps.findSimilarBeans) {
					return await deps.findSimilarBeans(input, { publicOnly: !access.memberAccess });
				}
				throw new Error('Session-mode similarity reader is unavailable');
			}
		}),

		catalog_facets: tool({
			description:
				'List the valid values (with listing counts) for one catalog field: supplier, country, processing_base_method, fermentation_type, drying_method, grade, or wholesale. Call this BEFORE filtering by a supplier/origin/process name you have not verified — never guess filter values. Results are cached, so reuse them within a conversation.',
			inputSchema: z.object({
				field: z.enum(CATALOG_FACET_FIELDS).describe('Which catalog field to enumerate'),
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe('Count only currently stocked listings (default: true)')
			}),
			execute: async (input) => getCatalogFacets(marketClient, input)
		}),

		supplier_list: tool({
			description:
				'List suppliers with CLI-owned aggregate signals per returned supplier: listing counts, price range, average Purveyor Score, and top origin countries. Use returned_suppliers, rows_examined, truncation, and caveats to describe the returned supplier slice for broad supplier questions.',
			inputSchema: z.object({
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe('Aggregate only currently stocked listings (default: true)'),
				non_wholesale_only: z
					.boolean()
					.optional()
					.describe('Exclude wholesale-only listings from supplier aggregates'),
				country: z.string().optional().describe('Limit aggregates to one origin country'),
				limit: z.number().optional().default(15).describe('Number of suppliers (max 25)')
			}),
			execute: async (input) => getSupplierList(marketClient, input)
		}),

		catalog_rank: tool({
			description:
				'Deterministically rank catalog coffees by an objective: premium (highest Purveyor Score), value (Purveyor Score per dollar), fresh_arrival (newest stocked), rare_origin (scarcest origins). Use this for "best / top / premium / value / just landed / unusual" questions instead of plain search. Narrate from each result\'s rank_basis and purveyor_score_factors — never invent your own ordering.',
			inputSchema: z.object({
				objective: z.enum(RANK_OBJECTIVES).describe('Ranking objective'),
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe('Rank only currently stocked coffees (default: true)'),
				supplier: z
					.string()
					.optional()
					.describe('Filter to one supplier (verify via supplier_list)'),
				country: z.string().optional().describe('Filter to one origin country'),
				process: z.string().optional().describe('Filter by processing method'),
				max_price: z.number().optional().describe('Maximum price per lb'),
				min_purveyor_score: z.number().optional().describe('Minimum Purveyor Score'),
				non_wholesale_only: z.boolean().optional().describe('Exclude wholesale-only listings'),
				limit: z.number().optional().default(8).describe('Number of results (max 15)')
			}),
			execute: async (input) => rankCatalog(marketClient, input),
			// Full rows stream to the client for canvas cards; the model sees the
			// same compact catalog view as coffee_catalog_search.
			toModelOutput: ({ output }) => ({
				type: 'json',
				value: compactCatalogSearchOutputForModel(
					output as unknown as Record<string, unknown>
				) as JSONValue
			})
		})
	};
}
