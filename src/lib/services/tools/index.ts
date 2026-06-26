/**
 * Domain-scoped AI tool definitions for the Purveyors chat service.
 *
 * This module aggregates tools from per-domain files under src/lib/services/tools/:
 *   catalogTools.ts      — coffee_catalog_search, find_similar_beans, catalog_facets,
 *                          supplier_list, catalog_rank
 *   inventoryTools.ts    — green_coffee_inventory, add_bean_to_inventory, update_bean
 *   roastTools.ts        — roast_profiles, create_roast_session, update_roast_notes
 *   tastingTools.ts      — bean_tasting_notes
 *   marketTools.ts       — price_index_read (conditional on deps)
 *   presentationTools.ts — present_results
 *   shared.ts            — shared utilities and types
 *
 * The public API (createChatTools, ChatToolAccess, ChatToolDeps, InventoryRoastSummary)
 * is identical to the original src/lib/services/tools.ts.
 *
 * @see src/lib/services/tools.ts — re-export barrel preserving all existing import paths
 */

import type { ToolSet } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatToolAccess, ChatToolDeps } from './shared';

import { createCatalogTools } from './catalogTools';
import { createInventoryTools } from './inventoryTools';
import { createRoastTools } from './roastTools';
import { createTastingTools } from './tastingTools';
import { createMarketTools } from './marketTools';
import { createPresentationTools } from './presentationTools';

// Re-export shared types so consumers can import them from this module
export type { ChatToolAccess, ChatToolDeps, InventoryRoastSummary } from './shared';

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
 */
export function createChatTools(
	supabase: SupabaseClient,
	userId: string,
	access: ChatToolAccess = { memberAccess: false, ppiAccess: false },
	deps: ChatToolDeps = {}
): ToolSet {
	const catalogTools = createCatalogTools(supabase, access, deps);
	const inventoryTools = createInventoryTools(supabase, userId, access);
	const roastTools = createRoastTools(supabase, userId);
	const tastingTools = createTastingTools(supabase, userId);
	const priceIndexTools = createMarketTools(deps) as ToolSet;
	const presentationTools = createPresentationTools();

	const tools: ToolSet = {
		...catalogTools,
		...inventoryTools,
		...roastTools,
		...tastingTools,
		...presentationTools
	};

	// price_index_read requires a server-injected reader (admin client); it is
	// only registered when the chat route provides one.

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
