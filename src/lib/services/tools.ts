import { tool, type ToolSet } from 'ai';
import type { JSONValue } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	searchCatalog,
	findSimilarBeans,
	findSimilarBeansSchema,
	type SearchCatalogInput,
	type CatalogItem,
	type SimilarBean
} from '@purveyors/cli/catalog';
import { listInventory } from '@purveyors/cli/inventory';
import { listRoasts, type RoastProfile } from '@purveyors/cli/roast';
import { getTastingNotes, getTastingNotesSchema } from '@purveyors/cli/tasting';
import {
	CATALOG_FACET_FIELDS,
	RANK_OBJECTIVES,
	getCatalogFacets,
	getSupplierList,
	rankCatalog,
	type MarketToolsClient
} from '$lib/services/marketTools';
import {
	compactActionCardOutputForModel,
	compactCatalogSearchOutputForModel
} from '$lib/services/toolModelOutput';

/**
 * Coerce falsy or non-positive numeric IDs to undefined.
 * LLMs sometimes pass 0 for optional ID fields meaning "no filter".
 * CLI Zod schemas use .positive() and reject 0.
 */
function positiveOrUndef(val: number | undefined | null): number | undefined {
	return typeof val === 'number' && val > 0 ? val : undefined;
}

type InventoryResult = Awaited<ReturnType<typeof listInventory>>[number];

function stripInventoryRoastProfileData<T extends InventoryResult>(
	rows: T[]
): Array<T & { roast_profiles: [] }> {
	return rows.map((row) => ({ ...row, roast_profiles: [] }));
}

export interface InventoryRoastSummary {
	total_roasts: number;
	last_roast_date: string | null;
	total_oz_in: number;
}

/**
 * Attach per-item roast summaries to inventory rows. The CLI's listInventory
 * selects no roast data (roast_profiles.coffee_id → green_coffee_inv.id), so
 * without this every canvas inventory table shows 0 roasts.
 */
async function attachRoastSummaries<T extends InventoryResult>(
	supabase: SupabaseClient,
	userId: string,
	rows: T[]
): Promise<Array<T & { roast_summary: InventoryRoastSummary }>> {
	const summaries = new Map<number, InventoryRoastSummary>();

	const ids = rows.map((row) => row.id).filter((id): id is number => typeof id === 'number');
	if (ids.length > 0) {
		const { data, error } = await supabase
			.from('roast_profiles')
			.select('coffee_id, roast_date, oz_in')
			.eq('user', userId)
			.in('coffee_id', ids);
		if (error) throw new Error(`roast_profiles query failed: ${error.message}`);

		for (const roast of data ?? []) {
			const existing = summaries.get(roast.coffee_id) ?? {
				total_roasts: 0,
				last_roast_date: null,
				total_oz_in: 0
			};
			existing.total_roasts += 1;
			existing.total_oz_in += typeof roast.oz_in === 'number' ? roast.oz_in : 0;
			const roastDate = typeof roast.roast_date === 'string' ? roast.roast_date : null;
			if (roastDate && (!existing.last_roast_date || roastDate > existing.last_roast_date)) {
				existing.last_roast_date = roastDate;
			}
			summaries.set(roast.coffee_id, existing);
		}
	}

	return rows.map((row) => ({
		...row,
		roast_summary: summaries.get(row.id as number) ?? {
			total_roasts: 0,
			last_roast_date: null,
			total_oz_in: 0
		}
	}));
}

/**
 * Creates the set of AI tools for the chat service.
 *
 * All tools call @purveyors/cli library functions directly via the supabase
 * client — no internal HTTP hop required. This is the flywheel: CLI
 * improvements automatically improve the chat agent.
 *
 * READ TOOLS — execute immediately, return data:
 *   coffee_catalog_search  → searchCatalog()
 *   green_coffee_inventory → listInventory()
 *   roast_profiles         → listRoasts()
 *   bean_tasting_notes     → getTastingNotes()
 *   find_similar_beans     → findSimilarBeans()
 *   catalog_facets         → getCatalogFacets()  (valid filter values, cached)
 *   supplier_list          → getSupplierList()   (supplier universe, cached)
 *   catalog_rank           → rankCatalog()       (deterministic objective ranking)
 *   price_index_read       → deps.readPriceIndex (aggregate market index, admin client)
 *
 * WRITE TOOLS — proposal pattern, return action_card for user confirmation:
 *   add_bean_to_inventory  → execute-action calls addInventory()
 *   update_bean            → execute-action calls updateInventory()
 *   create_roast_session   → execute-action calls createRoast()
 *   update_roast_notes     → no CLI equivalent yet; execute-action uses Supabase directly
 *   record_sale            → execute-action calls recordSale()
 *
 * Write tool execute() bodies return action_card proposals only — the actual
 * write happens in /api/chat/execute-action when the user confirms. The CLI
 * imports above are referenced in executor comments so execute-action can be
 * migrated to use them in a follow-up PR.
 *
 * The /api/tools/* endpoints are kept for backward compatibility but are
 * @deprecated — prefer CLI imports going forward.
 *
 * ## Schema source-of-truth strategy (Never Repeat Truth)
 *
 * Where the CLI schema matches what the LLM needs, we import it directly so
 * the CLI is the single source of truth:
 *   bean_tasting_notes  → getTastingNotesSchema  (from @purveyors/cli/tasting)
 *   find_similar_beans  → findSimilarBeansSchema  (from @purveyors/cli/catalog)
 *
 * Tools with intentionally richer LLM-facing schemas keep manual schemas:
 *   coffee_catalog_search  — 12 LLM fields vs CLI's 7; extras client-side filtered
 *   green_coffee_inventory — 4 LLM hint fields vs CLI's 2
 *   roast_profiles         — 10 LLM fields vs CLI's 2; extras client-side filtered
 *
 * Write tools always keep manual schemas (action_card shape is chat-specific).
 */
export interface ChatToolAccess {
	ppiAccess?: boolean;
	memberAccess?: boolean;
}

/**
 * Server-injected dependencies for tools that cannot run on the user-scoped
 * client (e.g. price_index_read needs the admin client because
 * price_index_snapshots revokes SELECT from authenticated users).
 */
export interface ChatToolDeps {
	readPriceIndex?: (input: {
		origin?: string;
		process?: string;
		days?: number;
		wholesale?: boolean;
		limit?: number;
	}) => Promise<unknown>;
	findSimilarBeans?: (
		input: {
			coffee_id: number;
			threshold?: number;
			limit?: number;
		},
		options: { publicOnly: boolean }
	) => Promise<unknown>;
}

export function createChatTools(
	supabase: SupabaseClient,
	userId: string,
	access: ChatToolAccess = { memberAccess: false, ppiAccess: false },
	deps: ChatToolDeps = {}
): ToolSet {
	const marketClient = supabase as unknown as MarketToolsClient;

	const tools = {
		// ─── Read Tools (CLI imports) ───────────────────────────────────────────

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
				// Map chat tool input shape to CLI function input shape.
				// name, supplier, ids are now natively supported by the CLI (v0.8.3+).
				// Remaining client-side filters: variety, stocked_days, drying_method.
				const cliInput: SearchCatalogInput = {
					limit: Math.min(input.limit ?? 10, 15),
					stocked: input.stocked_only ?? true
				};

				if (input.origin) cliInput.origin = input.origin;
				if (input.process) cliInput.process = input.process;
				if (input.name) cliInput.name = input.name;
				if (input.supplier) cliInput.supplier = input.supplier;
				const filteredIds = input.coffee_ids?.filter((id) => id > 0);
				if (filteredIds && filteredIds.length > 0) cliInput.ids = filteredIds;

				// price_range [min, max] → priceMin / priceMax
				if (input.price_range) {
					const [min, max] = input.price_range;
					if (min != null) cliInput.priceMin = min;
					if (max != null) cliInput.priceMax = max;
				}

				// flavor_keywords string[] → comma-joined flavor string
				if (input.flavor_keywords && input.flavor_keywords.length > 0) {
					cliInput.flavor = input.flavor_keywords.join(', ');
				}

				let coffees = await searchCatalog(supabase, cliInput);

				// Client-side post-filters for params the CLI doesn't support yet
				if (input.drying_method) {
					const dryingLower = input.drying_method.toLowerCase();
					coffees = coffees.filter((c) => c.drying_method?.toLowerCase().includes(dryingLower));
				}

				if (input.variety) {
					const varietyLower = input.variety.toLowerCase();
					coffees = coffees.filter(
						(c) =>
							c.cultivar_detail?.toLowerCase().includes(varietyLower) ||
							c.description_short?.toLowerCase().includes(varietyLower)
					);
				}

				if (input.stocked_days) {
					const cutoff = new Date();
					cutoff.setDate(cutoff.getDate() - input.stocked_days);
					coffees = coffees.filter((c) => {
						if (!c.stocked_date) return false;
						return new Date(c.stocked_date) >= cutoff;
					});
				}

				return {
					coffees,
					total: coffees.length,
					filters_applied: input,
					search_strategy: 'structured' as const
				};
			},
			// Full rows stream to the client for cards; the model sees a compact
			// view (long prose dropped/truncated) to keep token cost flat.
			toModelOutput: ({ output }) => ({
				type: 'json',
				value: compactCatalogSearchOutputForModel(output) as JSONValue
			})
		}),

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
				const finalLimit = Math.min(input.limit ?? 10, 15);

				// CLI listRoasts supports these filters server-side; roast_name and date range
				// are applied client-side after fetching.
				let profiles: RoastProfile[] = await listRoasts(supabase, userId, {
					coffee_id: positiveOrUndef(input.coffee_id),
					roast_id: positiveOrUndef(input.roast_id ? parseInt(input.roast_id, 10) : undefined),
					batch_name: input.batch_name,
					catalog_id: positiveOrUndef(input.catalog_id),
					stocked_only: input.stocked_only,
					limit: finalLimit * 3 // fetch more to allow for client-side filtering
				});

				// Client-side post-filters for params the CLI doesn't support server-side
				if (input.roast_name) {
					const nameLower = input.roast_name.toLowerCase();
					profiles = profiles.filter((p) => p.coffee_name?.toLowerCase().includes(nameLower));
				}

				if (input.roast_date_start) {
					profiles = profiles.filter(
						(p) => p.roast_date && p.roast_date >= input.roast_date_start!
					);
				}

				if (input.roast_date_end) {
					profiles = profiles.filter((p) => p.roast_date && p.roast_date <= input.roast_date_end!);
				}

				// Trim to requested limit after client-side filtering
				profiles = profiles.slice(0, finalLimit);

				// Add formatted time fields so LLM sees "7:07" not raw seconds
				const formatTime = (seconds: number | null | undefined): string | null => {
					if (seconds == null) return null;
					const m = Math.floor(seconds / 60);
					const s = Math.floor(seconds % 60);
					return `${m}:${s.toString().padStart(2, '0')}`;
				};

				const TIME_FIELDS = [
					'total_roast_time',
					'fc_start_time',
					'fc_end_time',
					'drop_time',
					'tp_time',
					'charge_time',
					'cool_time',
					'dry_end_time',
					'sc_start_time'
				] as string[];

				const profilesWithFmt = profiles.map((p) => {
					const extra: Record<string, string | null> = {};
					for (const field of TIME_FIELDS) {
						const val = (p as unknown as Record<string, unknown>)[field];
						extra[`${field}_fmt`] = formatTime(typeof val === 'number' ? val : null);
					}
					return { ...p, ...extra };
				});

				return {
					profiles: profilesWithFmt,
					total: profilesWithFmt.length,
					filters_applied: input
				};
			}
		}),

		bean_tasting_notes: tool({
			description:
				'Get tasting notes and radar chart data for a specific coffee bean; user data, supplier data, or both',
			inputSchema: getTastingNotesSchema,
			execute: async (input) => {
				// CLI schema field names match execute params (bean_id, filter).
				// include_radar_data was chat-specific; CLI returns cupping_notes
				// as raw JSON which contains radar-compatible data.
				if (!input.bean_id || input.bean_id <= 0) {
					return {
						error:
							'bean_id is required and must be a positive integer. Please specify which bean to get tasting notes for.'
					};
				}
				const result = await getTastingNotes(supabase, userId, input.bean_id, input.filter);
				return result;
			}
		}),

		find_similar_beans: tool({
			description:
				'Find beans similar to a specific coffee across all suppliers. Uses embedding similarity on origin, processing, and tasting profiles. Returns ranked matches with similarity scores.',
			inputSchema: findSimilarBeansSchema,
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
				const results: SimilarBean[] = await findSimilarBeans(supabase, input);
				return results;
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
				'List suppliers with CLI-owned aggregate signals per returned supplier: listing counts, price range, average Purveyor Score, and top origin countries. Use total_suppliers, returned_suppliers, truncation, and caveats to describe coverage for broad supplier questions.',
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
		}),

		// ─── Write Tools (propose-only, no execution) ──────────────────────────

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
				roaster_type: z.string().optional().describe('Roaster type'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why this roast session is proposed')
			}),
			execute: async (input) => {
				// When user confirms the action_card, execute-action should call:
				//   createRoast(supabase, userId, {
				//     coffeeId: params.coffee_id,
				//     batchName: params.batch_name,
				//     ozIn: params.oz_in,
				//     roastDate: params.roast_date,
				//     notes: params.roast_notes,
				//   })
				if (!input.coffee_id || input.coffee_id <= 0) {
					return {
						error:
							'coffee_id is required and must be a positive integer. Please specify which inventory coffee to create a roast session for.'
					};
				}
				return {
					action_card: {
						actionType: 'create_roast_session',
						summary: `Create roast session: ${input.batch_name} (${input.coffee_name})`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'coffee_id',
								label: 'Coffee ID',
								value: input.coffee_id,
								type: 'number',
								editable: false
							},
							{
								key: 'coffee_name',
								label: 'Coffee Name',
								value: input.coffee_name,
								type: 'text',
								editable: true
							},
							{
								key: 'batch_name',
								label: 'Batch Name',
								value: input.batch_name,
								type: 'text',
								editable: true
							},
							{
								key: 'roast_date',
								label: 'Roast Date',
								value: input.roast_date || new Date().toISOString().split('T')[0],
								type: 'date',
								editable: true
							},
							...(input.oz_in != null
								? [
										{
											key: 'oz_in',
											label: 'Weight In (oz)',
											value: input.oz_in,
											type: 'number',
											editable: true
										}
									]
								: []),
							...(input.roast_notes
								? [
										{
											key: 'roast_notes',
											label: 'Notes',
											value: input.roast_notes,
											type: 'textarea',
											editable: true
										}
									]
								: []),
							...(input.roaster_type
								? [
										{
											key: 'roaster_type',
											label: 'Roaster',
											value: input.roaster_type,
											type: 'text',
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

		update_roast_notes: tool({
			description: 'Propose updating notes or targets on an existing roast profile.',
			inputSchema: z.object({
				roast_id: z.number().describe('Roast profile ID'),
				roast_notes: z.string().optional().describe('Updated roast notes'),
				roast_targets: z.string().optional().describe('Updated roast targets'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why these notes are proposed')
			}),
			execute: async (input) => {
				// No direct CLI equivalent yet — execute-action uses Supabase directly:
				//   supabase.from('roast_profiles').update({ roast_notes, roast_targets })
				//     .eq('roast_id', params.roast_id).eq('user', userId)
				if (!input.roast_id || input.roast_id <= 0) {
					return {
						error:
							'roast_id is required and must be a positive integer. Please specify which roast profile to update.'
					};
				}
				return {
					action_card: {
						actionType: 'update_roast_notes',
						summary: `Update notes for roast #${input.roast_id}`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'roast_id',
								label: 'Roast ID',
								value: input.roast_id,
								type: 'number',
								editable: false
							},
							...(input.roast_notes != null
								? [
										{
											key: 'roast_notes',
											label: 'Roast Notes',
											value: input.roast_notes,
											type: 'textarea',
											editable: true
										}
									]
								: []),
							...(input.roast_targets != null
								? [
										{
											key: 'roast_targets',
											label: 'Roast Targets',
											value: input.roast_targets,
											type: 'textarea',
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
		}),

		present_results: tool({
			description:
				'Present curated results with annotations and layout control. Call AFTER a search tool to control what the user sees.',
			inputSchema: z.object({
				source_tool: z.enum([
					'coffee_catalog_search',
					'catalog_rank',
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

	// price_index_read requires a server-injected reader (admin client); it is
	// only registered when the chat route provides one.
	const readPriceIndex = deps.readPriceIndex;
	const priceIndexTools: ToolSet = readPriceIndex
		? {
				price_index_read: tool({
					description:
						'Read the Parchment Market Index: aggregate green coffee price snapshots (min/p25/median/avg/p75/max per lb, supplier and listing counts) by origin and process over a time window. Use for market pricing questions like "is this priced well?" or "what are Ethiopia naturals going for?". Aggregate data only — never per-supplier prices.',
					inputSchema: z.object({
						origin: z.string().optional().describe('Origin country to filter snapshots'),
						process: z.string().optional().describe('Processing method to filter snapshots'),
						days: z.number().optional().default(90).describe('Lookback window in days (max 365)'),
						wholesale: z
							.boolean()
							.optional()
							.describe('Filter to wholesale-only (true) or retail (false) segments'),
						limit: z.number().optional().default(30).describe('Number of snapshots (max 60)')
					}),
					execute: async (input) => readPriceIndex(input)
				})
			}
		: {};

	if (access.memberAccess) return { ...tools, ...priceIndexTools };

	if (access.ppiAccess) {
		const ppiTools: ToolSet = {
			coffee_catalog_search: tools.coffee_catalog_search,
			green_coffee_inventory: tools.green_coffee_inventory,
			find_similar_beans: tools.find_similar_beans,
			catalog_facets: tools.catalog_facets,
			supplier_list: tools.supplier_list,
			catalog_rank: tools.catalog_rank,
			add_bean_to_inventory: tools.add_bean_to_inventory,
			update_bean: tools.update_bean,
			present_results: tools.present_results,
			...priceIndexTools
		};
		return ppiTools;
	}

	const minimalTools: ToolSet = {
		coffee_catalog_search: tools.coffee_catalog_search,
		catalog_facets: tools.catalog_facets,
		present_results: tools.present_results
	};
	return minimalTools;
}
