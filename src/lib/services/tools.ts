import { tool } from 'ai';
import { z } from 'zod';

/**
 * Creates the set of AI tools for the chat service.
 *
 * Each tool calls an internal /api/tools/* endpoint with auth headers
 * and returns the raw JSON result for the model to interpret.
 */
export function createChatTools(baseUrl: string, authHeaders: Record<string, string>) {
	async function callTool(endpoint: string, input: unknown): Promise<unknown> {
		const url = baseUrl + endpoint;
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders },
			body: JSON.stringify(input)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Tool call failed: ${response.status} ${response.statusText} - ${errorText}`);
		}

		return response.json();
	}

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
				score_min: z.number().optional().describe('Minimum cupping score'),
				score_max: z.number().optional().describe('Maximum cupping score'),
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
				return callTool('/api/tools/coffee-catalog', input);
			}
		}),

		green_coffee_inventory: tool({
			description:
				"Get the user's personal coffee inventory with purchase history and roast summaries",
			inputSchema: z.object({
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						'Only show currently stocked beans (default: true, use false for historical analysis)'
					),
				include_catalog_details: z
					.boolean()
					.optional()
					.describe('Include full catalog information'),
				include_roast_summary: z.boolean().optional().describe('Include roasting statistics'),
				limit: z.number().optional().default(15).describe('Number of results to return (max 15)')
			}),
			execute: async (input) => {
				return callTool('/api/tools/green-coffee-inv', input);
			}
		}),

		roast_profiles: tool({
			description:
				"Get user's roast profiles with filtering, timing data, temperature milestones, and advanced analytics",
			inputSchema: z.object({
				roast_id: z.string().optional().describe('Specific roast ID'),
				roast_name: z.string().optional().describe('Search by roast name'),
				batch_name: z.string().optional().describe('Search by batch name'),
				coffee_id: z
					.number()
					.optional()
					.describe('Filter by green coffee inventory ID - use this for specific coffee analysis'),
				catalog_id: z
					.number()
					.optional()
					.describe(
						'Filter by catalog ID (use this when you have an ID from coffee_catalog_search)'
					),
				roast_date_start: z
					.string()
					.optional()
					.describe('Start date for date range filtering (YYYY-MM-DD format)'),
				roast_date_end: z
					.string()
					.optional()
					.describe('End date for date range filtering (YYYY-MM-DD format)'),
				limit: z.number().optional().default(10).describe('Number of results (max 15)'),
				include_calculations: z
					.boolean()
					.optional()
					.default(true)
					.describe('Include comprehensive summary statistics and analytics'),
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						'Only show roasts for currently stocked coffee (default: true, use false for historical analysis)'
					)
			}),
			execute: async (input) => {
				return callTool('/api/tools/roast-profiles', input);
			}
		}),

		bean_tasting_notes: tool({
			description:
				'Get tasting notes and radar chart data for a specific coffee bean; user data, supplier data, or both',
			inputSchema: z.object({
				bean_id: z.number().describe('Required coffee bean ID'),
				filter: z.enum(['user', 'supplier', 'both']).describe('Which tasting notes to include'),
				include_radar_data: z.boolean().optional().describe('Include radar chart data')
			}),
			execute: async (input) => {
				return callTool('/api/tools/bean-tasting', input);
			}
		}),

		present_results: tool({
			description:
				'Present curated results with annotations and layout control. Call AFTER a search tool to control what the user sees.',
			inputSchema: z.object({
				source_tool: z.enum([
					'coffee_catalog_search',
					'green_coffee_inventory',
					'roast_profiles'
				]),
				layout: z
					.enum(['inline', 'grid', 'focused'])
					.describe(
						'inline: vertical stack for exploration. grid: side-by-side for comparison. focused: single highlighted recommendation.'
					),
				items: z.array(
					z.object({
						id: z.number().describe('Item ID from search results'),
						annotation: z
							.string()
							.optional()
							.describe('Natural language annotation for this item'),
						highlight: z
							.boolean()
							.optional()
							.describe('Visually emphasize this item as top pick')
					})
				)
			}),
			execute: async (input) => ({ presentation: input })
		})
	};
}
