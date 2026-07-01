import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { searchCatalog, type CatalogItem } from '@purveyors/cli/catalog';
import { listInventory } from '@purveyors/cli/inventory';
import { compactActionCardOutputForModel } from '$lib/services/toolModelOutput';
import type { JSONValue } from 'ai';
import {
	positiveOrUndef,
	attachRoastSummaries,
	stripInventoryRoastProfileData,
	type ChatToolAccess
} from './shared';

export function createInventoryTools(
	supabase: SupabaseClient,
	userId: string,
	access: ChatToolAccess
) {
	return {
		green_coffee_inventory: tool({
			description: access.memberAccess
				? "Get the user's personal coffee inventory with purchase history and roast summaries"
				: "Get the user's personal coffee inventory with purchase history",
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
				// CLI listInventory supports stocked filter directly; limit applied as cap.
				// include_catalog_details and include_roast_summary are not CLI params.
				// Parchment Intelligence-only users receive portfolio data without Mallard roast details.
				const finalLimit = Math.min(input.limit ?? 15, 15);
				const includeRoastProfiles = access.memberAccess === true;

				const rawInventory = await listInventory(supabase, userId, {
					stocked_only: input.stocked_only ?? true,
					limit: finalLimit
				});
				const inventory = includeRoastProfiles
					? await attachRoastSummaries(supabase, userId, rawInventory)
					: stripInventoryRoastProfileData(rawInventory);

				const summary = {
					total_beans: inventory.length,
					total_weight_lbs: inventory.reduce((sum, bean) => sum + (bean.purchased_qty_lbs ?? 0), 0),
					total_value: inventory.reduce((sum, bean) => {
						return sum + (bean.bean_cost ?? 0) + (bean.tax_ship_cost ?? 0);
					}, 0),
					stocked_beans: inventory.filter((bean) => bean.stocked).length
				};

				return {
					inventory,
					total: inventory.length,
					summary,
					filters_applied: {
						stocked_only: input.stocked_only ?? true,
						include_catalog_details: input.include_catalog_details ?? true,
						include_roast_summary: includeRoastProfiles && (input.include_roast_summary ?? true),
						limit: finalLimit
					}
				};
			}
		}),

		add_bean_to_inventory: tool({
			description:
				"Propose adding a green coffee bean to the user's inventory. Returns an action card for user confirmation. Use catalog_id when adding a bean from the catalog.",
			inputSchema: z.object({
				catalog_id: z
					.number()
					.optional()
					.describe('Coffee catalog ID (from coffee_catalog_search results)'),
				manual_name: z.string().optional().describe('Manual coffee name if not from catalog'),
				purchased_qty_lbs: z.number().describe('Quantity purchased in pounds'),
				cost_per_lb: z.number().optional().describe('Cost per pound in dollars'),
				tax_ship_cost: z.number().optional().describe('Tax and shipping cost (total)'),
				purchase_date: z.string().optional().describe('Purchase date (YYYY-MM-DD)'),
				notes: z.string().optional().describe('Notes about this purchase'),
				reasoning: z
					.string()
					.optional()
					.describe(
						'Brief explanation of why this action is being proposed, e.g. "Adding this Ethiopian natural based on your interest in fruity coffees"'
					)
			}),
			execute: async (input) => {
				// Sanitize catalog_id early — LLM may pass 0 meaning "no specific bean"
				const catalogId = positiveOrUndef(input.catalog_id);

				// When user confirms the action_card, execute-action should call:
				//   addInventory(supabase, userId, {
				//     catalogId: params.catalog_id,
				//     qty: params.purchased_qty_lbs,
				//     cost: params.cost_per_lb * params.purchased_qty_lbs,
				//     taxShip: params.tax_ship_cost,
				//     notes: params.notes,
				//     purchaseDate: params.purchase_date,
				//   })

				// Fetch all stocked catalog beans for the dropdown using CLI directly
				let allBeans: Array<{ id: number; name: string | null; source?: string | null }> = [];
				let beanSelectOptions: Array<{ label: string; value: string }> = [];
				let sourceOptions: Array<{ label: string; value: string }> = [];
				try {
					const catalogItems: CatalogItem[] = await searchCatalog(supabase, {
						stocked: true,
						limit: 500
					});
					if (catalogItems) {
						allBeans = catalogItems.map((c) => ({ id: c.id, name: c.name, source: c.source }));
						beanSelectOptions = allBeans.map((c) => ({
							label: c.name ?? `Coffee #${c.id}`,
							value: String(c.id)
						}));
						// Extract unique sources for the filter dropdown
						const uniqueSources = [
							...new Set(allBeans.map((c) => c.source).filter(Boolean))
						] as string[];
						sourceOptions = [
							{ label: 'All Suppliers', value: '__all__' },
							...uniqueSources.sort().map((s) => ({ label: s, value: s }))
						];
					}
				} catch {
					// If catalog fetch fails, fall back to static catalog_id
				}

				const costPerLb = input.cost_per_lb ?? 0;
				const qty = input.purchased_qty_lbs;
				const totalBeanCost = Math.round(costPerLb * qty * 100) / 100;

				// Determine which bean is pre-selected
				const preSelectedValue = catalogId ? String(catalogId) : beanSelectOptions[0]?.value;
				const preSelectedBean = allBeans.find((c) => String(c.id) === preSelectedValue);
				const preSelectedLabel = preSelectedBean?.name || input.manual_name || '';
				const preSelectedSource = preSelectedBean?.source || '__all__';

				return {
					action_card: {
						actionType: 'add_bean_to_inventory',
						summary: `Add ${preSelectedLabel || input.manual_name || `catalog #${catalogId}`} to inventory (${qty} lbs)`,
						reasoning: input.reasoning,
						fields: [
							// Source filter + Bean dropdown (if we have catalog options) or manual name fallback
							...(beanSelectOptions.length > 0
								? [
										{
											key: 'source_filter',
											label: 'Supplier',
											value: preSelectedSource,
											type: 'select' as const,
											editable: true,
											selectOptions: sourceOptions
										},
										{
											key: 'coffee_bean',
											label: 'Coffee Bean',
											value: preSelectedValue,
											type: 'select' as const,
											editable: true,
											selectOptions: beanSelectOptions
										},
										{
											key: '_bean_sources',
											label: '',
											value: Object.fromEntries(
												allBeans.map((c) => [String(c.id), c.source || ''])
											),
											type: 'hidden' as const,
											editable: false
										},
										{
											key: 'catalog_id',
											label: 'Catalog ID',
											value: catalogId || Number(preSelectedValue),
											type: 'number' as const,
											editable: false
										}
									]
								: [
										...(catalogId
											? [
													{
														key: 'catalog_id',
														label: 'Catalog ID',
														value: catalogId,
														type: 'number' as const,
														editable: false
													}
												]
											: []),
										...(input.manual_name
											? [
													{
														key: 'manual_name',
														label: 'Coffee Name',
														value: input.manual_name,
														type: 'text' as const,
														editable: true
													}
												]
											: [])
									]),
							{
								key: 'purchased_qty_lbs',
								label: 'Quantity (lbs)',
								value: qty,
								type: 'number' as const,
								editable: true
							},
							...(input.cost_per_lb != null
								? [
										{
											key: 'cost_per_lb',
											label: 'Cost/lb ($)',
											value: costPerLb,
											type: 'number' as const,
											editable: true
										}
									]
								: []),
							...(input.cost_per_lb != null
								? [
										{
											key: 'total_bean_cost',
											label: 'Total Bean Cost ($)',
											value: totalBeanCost,
											type: 'number' as const,
											editable: false
										}
									]
								: []),
							...(input.tax_ship_cost != null
								? [
										{
											key: 'tax_ship_cost',
											label: 'Tax & Shipping ($)',
											value: input.tax_ship_cost,
											type: 'number' as const,
											editable: true
										}
									]
								: []),
							{
								key: 'purchase_date',
								label: 'Purchase Date',
								value: input.purchase_date || new Date().toISOString().split('T')[0],
								type: 'date' as const,
								editable: true
							},
							...(input.notes
								? [
										{
											key: 'notes',
											label: 'Notes',
											value: input.notes,
											type: 'textarea' as const,
											editable: true
										}
									]
								: [])
						],
						status: 'proposed'
					}
				};
			},
			// The card carries hundreds of dropdown options for the UI; the model
			// only needs the proposed values.
			toModelOutput: ({ output }) => ({
				type: 'json',
				value: compactActionCardOutputForModel(output) as JSONValue
			})
		}),

		update_bean: tool({
			description:
				"Propose updating a bean in the user's inventory. Specify the inventory bean ID and fields to change.",
			inputSchema: z.object({
				bean_id: z.number().describe('Green coffee inventory ID'),
				rank: z.number().optional().describe('Bean ranking (1-5)'),
				notes: z.string().optional().describe('Updated notes'),
				stocked: z.boolean().optional().describe('Whether the bean is currently stocked'),
				purchased_qty_lbs: z.number().optional().describe('Updated quantity'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why this update is proposed')
			}),
			execute: async (input) => {
				// When user confirms the action_card, execute-action should call:
				//   updateInventory(supabase, userId, params.bean_id, {
				//     qty: params.purchased_qty_lbs,
				//     notes: params.notes,
				//     stocked: params.stocked,
				//   })
				if (!input.bean_id || input.bean_id <= 0) {
					return {
						error:
							'bean_id is required and must be a positive integer. Please specify which inventory bean to update.'
					};
				}
				return {
					action_card: {
						actionType: 'update_bean',
						summary: `Update inventory bean #${input.bean_id}`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'bean_id',
								label: 'Bean ID',
								value: input.bean_id,
								type: 'number',
								editable: false
							},
							...(input.rank != null
								? [
										{
											key: 'rank',
											label: 'Rank',
											value: input.rank,
											type: 'number',
											editable: true
										}
									]
								: []),
							...(input.notes != null
								? [
										{
											key: 'notes',
											label: 'Notes',
											value: input.notes,
											type: 'textarea',
											editable: true
										}
									]
								: []),
							...(input.stocked != null
								? [
										{
											key: 'stocked',
											label: 'Stocked',
											value: input.stocked,
											type: 'select',
											editable: true,
											options: ['true', 'false']
										}
									]
								: []),
							...(input.purchased_qty_lbs != null
								? [
										{
											key: 'purchased_qty_lbs',
											label: 'Quantity (lbs)',
											value: input.purchased_qty_lbs,
											type: 'number',
											editable: true
										}
									]
								: [])
						],
						status: 'proposed'
					}
				};
			}
		}),

		record_sale: tool({
			description: 'Propose recording a sale of roasted coffee.',
			inputSchema: z.object({
				green_coffee_inv_id: z.number().describe('Green coffee inventory ID'),
				batch_name: z.string().describe('Batch name'),
				oz_sold: z.number().describe('Ounces sold'),
				price: z.number().describe('Sale price ($)'),
				buyer: z.string().describe('Buyer name'),
				sell_date: z.string().optional().describe('Sale date (YYYY-MM-DD)'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why this sale is being recorded')
			}),
			execute: async (input) => {
				// When user confirms the action_card, execute-action should call:
				//   recordSale(supabase, userId, {
				//     roastId: <resolved from batch_name lookup>,
				//     oz: params.oz_sold,
				//     price: params.price,
				//     buyer: params.buyer,
				//     sellDate: params.sell_date,
				//   })
				// Note: CLI recordSale takes roastId, not green_coffee_inv_id. The
				// execute-action handler currently uses a different schema (inv_id + batch_name).
				// Align schemas in a follow-up PR when execute-action is migrated to CLI.
				if (!input.green_coffee_inv_id || input.green_coffee_inv_id <= 0) {
					return {
						error:
							'green_coffee_inv_id is required and must be a positive integer. Please specify which inventory bean this sale is for.'
					};
				}
				return {
					action_card: {
						actionType: 'record_sale',
						summary: `Record sale: ${input.oz_sold}oz of ${input.batch_name} to ${input.buyer} ($${input.price})`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'green_coffee_inv_id',
								label: 'Inventory ID',
								value: input.green_coffee_inv_id,
								type: 'number',
								editable: false
							},
							{
								key: 'batch_name',
								label: 'Batch Name',
								value: input.batch_name,
								type: 'text',
								editable: true
							},
							{
								key: 'oz_sold',
								label: 'Oz Sold',
								value: input.oz_sold,
								type: 'number',
								editable: true
							},
							{
								key: 'price',
								label: 'Price ($)',
								value: input.price,
								type: 'number',
								editable: true
							},
							{
								key: 'buyer',
								label: 'Buyer',
								value: input.buyer,
								type: 'text',
								editable: true
							},
							{
								key: 'sell_date',
								label: 'Sale Date',
								value: input.sell_date || new Date().toISOString().split('T')[0],
								type: 'date',
								editable: true
							},
							{
								key: 'purchase_date',
								label: 'Purchase Date',
								value: new Date().toISOString().split('T')[0],
								type: 'date',
								editable: true
							}
						],
						status: 'proposed'
					}
				};
			}
		})
	};
}
