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

		// ─── Write Tools (propose-only, no execution) ──────────────────────────

		add_bean_to_inventory: tool({
			description:
				'Propose adding a green coffee bean to the user\'s inventory. Returns an action card for user confirmation. Use catalog_id when adding a bean from the catalog.',
			inputSchema: z.object({
				catalog_id: z.number().optional().describe('Coffee catalog ID (from coffee_catalog_search results)'),
				manual_name: z.string().optional().describe('Manual coffee name if not from catalog'),
				purchased_qty_lbs: z.number().describe('Quantity purchased in pounds'),
				cost_per_lb: z.number().optional().describe('Cost per pound in dollars'),
				tax_ship_cost: z.number().optional().describe('Tax and shipping cost (total)'),
				purchase_date: z.string().optional().describe('Purchase date (YYYY-MM-DD)'),
				notes: z.string().optional().describe('Notes about this purchase')
			}),
			execute: async (input) => {
				// Fetch stocked catalog beans for the dropdown
				let beanSelectOptions: Array<{ label: string; value: string }> = [];
				try {
					const catalogResult = await callTool('/api/tools/coffee-catalog', { stocked_only: true, limit: 15 }) as { coffees?: Array<{ id: number; name: string; source?: string }> };
					if (catalogResult.coffees) {
						beanSelectOptions = catalogResult.coffees.map((c) => ({
							label: c.source ? `${c.name} — ${c.source}` : c.name,
							value: String(c.id)
						}));
					}
				} catch {
					// If catalog fetch fails, fall back to static catalog_id
				}

				const costPerLb = input.cost_per_lb ?? 0;
				const qty = input.purchased_qty_lbs;
				const totalBeanCost = Math.round(costPerLb * qty * 100) / 100;

				// Determine which bean is pre-selected
				const preSelectedValue = input.catalog_id ? String(input.catalog_id) : beanSelectOptions[0]?.value;
				const preSelectedLabel = beanSelectOptions.find((o) => o.value === preSelectedValue)?.label || input.manual_name || '';

				return {
					action_card: {
						actionType: 'add_bean_to_inventory',
						summary: `Add ${preSelectedLabel || input.manual_name || `catalog #${input.catalog_id}`} to inventory (${qty} lbs)`,
						fields: [
							// Bean dropdown (if we have catalog options) or manual name fallback
							...(beanSelectOptions.length > 0
								? [
									{ key: 'coffee_bean', label: 'Coffee Bean', value: preSelectedValue, type: 'select' as const, editable: true, selectOptions: beanSelectOptions },
									{ key: 'catalog_id', label: 'Catalog ID', value: input.catalog_id || Number(preSelectedValue), type: 'number' as const, editable: false }
								]
								: [
									...(input.catalog_id ? [{ key: 'catalog_id', label: 'Catalog ID', value: input.catalog_id, type: 'number' as const, editable: false }] : []),
									...(input.manual_name ? [{ key: 'manual_name', label: 'Coffee Name', value: input.manual_name, type: 'text' as const, editable: true }] : [])
								]
							),
							{ key: 'purchased_qty_lbs', label: 'Quantity (lbs)', value: qty, type: 'number' as const, editable: true },
							...(input.cost_per_lb != null ? [{ key: 'cost_per_lb', label: 'Cost/lb ($)', value: costPerLb, type: 'number' as const, editable: true }] : []),
							...(input.cost_per_lb != null ? [{ key: 'total_bean_cost', label: 'Total Bean Cost ($)', value: totalBeanCost, type: 'number' as const, editable: false }] : []),
							...(input.tax_ship_cost != null ? [{ key: 'tax_ship_cost', label: 'Tax & Shipping ($)', value: input.tax_ship_cost, type: 'number' as const, editable: true }] : []),
							{ key: 'purchase_date', label: 'Purchase Date', value: input.purchase_date || new Date().toISOString().split('T')[0], type: 'date' as const, editable: true },
							...(input.notes ? [{ key: 'notes', label: 'Notes', value: input.notes, type: 'textarea' as const, editable: true }] : [])
						],
						status: 'proposed'
					}
				};
			}
		}),

		update_bean: tool({
			description:
				'Propose updating a bean in the user\'s inventory. Specify the inventory bean ID and fields to change.',
			inputSchema: z.object({
				bean_id: z.number().describe('Green coffee inventory ID'),
				rank: z.number().optional().describe('Bean ranking (1-5)'),
				notes: z.string().optional().describe('Updated notes'),
				stocked: z.boolean().optional().describe('Whether the bean is currently stocked'),
				purchased_qty_lbs: z.number().optional().describe('Updated quantity')
			}),
			execute: async (input) => ({
				action_card: {
					actionType: 'update_bean',
					summary: `Update inventory bean #${input.bean_id}`,
					fields: [
						{ key: 'bean_id', label: 'Bean ID', value: input.bean_id, type: 'number', editable: false },
						...(input.rank != null ? [{ key: 'rank', label: 'Rank', value: input.rank, type: 'number', editable: true }] : []),
						...(input.notes != null ? [{ key: 'notes', label: 'Notes', value: input.notes, type: 'textarea', editable: true }] : []),
						...(input.stocked != null ? [{ key: 'stocked', label: 'Stocked', value: input.stocked, type: 'select', editable: true, options: ['true', 'false'] }] : []),
						...(input.purchased_qty_lbs != null ? [{ key: 'purchased_qty_lbs', label: 'Quantity (lbs)', value: input.purchased_qty_lbs, type: 'number', editable: true }] : [])
					],
					status: 'proposed'
				}
			})
		}),

		create_roast_session: tool({
			description:
				'Propose creating a new roast session/profile. The user can then fill in details after executing.',
			inputSchema: z.object({
				coffee_id: z.number().describe('Green coffee inventory ID'),
				coffee_name: z.string().describe('Coffee name for the batch'),
				batch_name: z.string().describe('Batch name'),
				roast_date: z.string().optional().describe('Roast date (YYYY-MM-DD)'),
				oz_in: z.number().optional().describe('Weight in (oz)'),
				roast_notes: z.string().optional().describe('Roast notes or targets'),
				roaster_type: z.string().optional().describe('Roaster type')
			}),
			execute: async (input) => ({
				action_card: {
					actionType: 'create_roast_session',
					summary: `Create roast session: ${input.batch_name} (${input.coffee_name})`,
					fields: [
						{ key: 'coffee_id', label: 'Coffee ID', value: input.coffee_id, type: 'number', editable: false },
						{ key: 'coffee_name', label: 'Coffee Name', value: input.coffee_name, type: 'text', editable: true },
						{ key: 'batch_name', label: 'Batch Name', value: input.batch_name, type: 'text', editable: true },
						{ key: 'roast_date', label: 'Roast Date', value: input.roast_date || new Date().toISOString().split('T')[0], type: 'date', editable: true },
						...(input.oz_in != null ? [{ key: 'oz_in', label: 'Weight In (oz)', value: input.oz_in, type: 'number', editable: true }] : []),
						...(input.roast_notes ? [{ key: 'roast_notes', label: 'Notes', value: input.roast_notes, type: 'textarea', editable: true }] : []),
						...(input.roaster_type ? [{ key: 'roaster_type', label: 'Roaster', value: input.roaster_type, type: 'text', editable: true }] : [])
					],
					status: 'proposed'
				}
			})
		}),

		update_roast_notes: tool({
			description:
				'Propose updating notes or targets on an existing roast profile.',
			inputSchema: z.object({
				roast_id: z.number().describe('Roast profile ID'),
				roast_notes: z.string().optional().describe('Updated roast notes'),
				roast_targets: z.string().optional().describe('Updated roast targets')
			}),
			execute: async (input) => ({
				action_card: {
					actionType: 'update_roast_notes',
					summary: `Update notes for roast #${input.roast_id}`,
					fields: [
						{ key: 'roast_id', label: 'Roast ID', value: input.roast_id, type: 'number', editable: false },
						...(input.roast_notes != null ? [{ key: 'roast_notes', label: 'Roast Notes', value: input.roast_notes, type: 'textarea', editable: true }] : []),
						...(input.roast_targets != null ? [{ key: 'roast_targets', label: 'Roast Targets', value: input.roast_targets, type: 'textarea', editable: true }] : [])
					],
					status: 'proposed'
				}
			})
		}),

		record_sale: tool({
			description:
				'Propose recording a sale of roasted coffee.',
			inputSchema: z.object({
				green_coffee_inv_id: z.number().describe('Green coffee inventory ID'),
				batch_name: z.string().describe('Batch name'),
				oz_sold: z.number().describe('Ounces sold'),
				price: z.number().describe('Sale price ($)'),
				buyer: z.string().describe('Buyer name'),
				sell_date: z.string().optional().describe('Sale date (YYYY-MM-DD)')
			}),
			execute: async (input) => ({
				action_card: {
					actionType: 'record_sale',
					summary: `Record sale: ${input.oz_sold}oz of ${input.batch_name} to ${input.buyer} ($${input.price})`,
					fields: [
						{ key: 'green_coffee_inv_id', label: 'Inventory ID', value: input.green_coffee_inv_id, type: 'number', editable: false },
						{ key: 'batch_name', label: 'Batch Name', value: input.batch_name, type: 'text', editable: true },
						{ key: 'oz_sold', label: 'Oz Sold', value: input.oz_sold, type: 'number', editable: true },
						{ key: 'price', label: 'Price ($)', value: input.price, type: 'number', editable: true },
						{ key: 'buyer', label: 'Buyer', value: input.buyer, type: 'text', editable: true },
						{ key: 'sell_date', label: 'Sale Date', value: input.sell_date || new Date().toISOString().split('T')[0], type: 'date', editable: true },
						{ key: 'purchase_date', label: 'Purchase Date', value: new Date().toISOString().split('T')[0], type: 'date', editable: true }
					],
					status: 'proposed'
				}
			})
		}),

		present_results: tool({
			description:
				'Present curated results with annotations and layout control. Call AFTER a search tool to control what the user sees.',
			inputSchema: z.object({
				source_tool: z.enum(['coffee_catalog_search', 'green_coffee_inventory', 'roast_profiles']),
				layout: z
					.enum(['inline', 'grid', 'focused'])
					.describe(
						'inline: vertical stack for exploration. grid: side-by-side for comparison. focused: single highlighted recommendation.'
					),
				items: z.array(
					z.object({
						id: z.number().describe('Item ID from search results'),
						annotation: z.string().optional().describe('Natural language annotation for this item'),
						highlight: z.boolean().optional().describe('Visually emphasize this item as top pick')
					})
				),
				canvas_layout: z
					.enum(['focus', 'comparison', 'dashboard'])
					.optional()
					.describe(
						'Canvas layout hint. focus: single item with full detail. comparison: side-by-side evaluation. dashboard: grid of multiple items.'
					),
				canvas_action: z
					.enum(['replace', 'add', 'clear'])
					.optional()
					.describe(
						'Canvas action. replace: clear canvas and show new items (default). add: keep existing and add new. clear: clear canvas entirely.'
					)
			}),
			execute: async (input) => ({ presentation: input })
		})
	};
}
