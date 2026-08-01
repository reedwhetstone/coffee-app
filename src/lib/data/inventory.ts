/**
 * Inventory data layer — single source of truth for all green_coffee_inv queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - buildGreenCoffeeQuery / processGreenCoffeeData from greenCoffeeUtils are
 *    re-used here to avoid query duplication.
 *  - Shared-data reads and updates use Parchment contracts.
 *  - This module retains only catalog-backed creation until the atomic catalog
 *    batch contract is deployed and its consumer cutover lands.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { buildGreenCoffeeQuery, processGreenCoffeeData } from '$lib/server/greenCoffeeUtils.js';

// ── Re-export shared types for consumers ──────────────────────────────────────

export type {
	GreenCoffeeRow as InventoryItem,
	CoffeeCatalog,
	RoastProfile
} from '$lib/server/greenCoffeeUtils.js';

// ── Input / option types ──────────────────────────────────────────────────────

export interface InventoryCreateInput {
	catalog_id?: number | null;
	rank?: number | null;
	notes?: string | null;
	purchase_date?: string | null;
	purchased_qty_lbs?: number | null;
	bean_cost?: number | null;
	tax_ship_cost?: number | null;
	stocked?: boolean | null;
	cupping_notes?: Database['public']['Tables']['green_coffee_inv']['Insert']['cupping_notes'];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a new item to the user's inventory.
 * Returns the created item with full catalog + roast profile joins.
 */
export async function addToInventory(
	supabase: SupabaseClient,
	userId: string,
	data: InventoryCreateInput
) {
	const insertData: Database['public']['Tables']['green_coffee_inv']['Insert'] = {
		user: userId,
		catalog_id: data.catalog_id ?? null,
		last_updated: new Date().toISOString(),
		tax_ship_cost:
			typeof data.tax_ship_cost === 'number' ? parseFloat(data.tax_ship_cost.toFixed(2)) : 0.0,
		bean_cost: typeof data.bean_cost === 'number' ? parseFloat(data.bean_cost.toFixed(2)) : 0.0,
		rank: data.rank ?? null,
		notes: data.notes ?? null,
		purchase_date: data.purchase_date ?? null,
		purchased_qty_lbs: data.purchased_qty_lbs ?? null,
		stocked:
			data.stocked !== undefined && data.stocked !== null
				? data.stocked
				: typeof data.purchased_qty_lbs === 'number' && data.purchased_qty_lbs * 16 >= 4
					? true
					: false,
		cupping_notes: data.cupping_notes ?? null
	};

	const { data: newRow, error } = await supabase
		.from('green_coffee_inv')
		.insert(insertData)
		.select()
		.single();

	if (error) throw error;

	// Fetch with full joins
	const { data: fullRow } = await buildGreenCoffeeQuery(supabase).eq('id', newRow.id).single();

	return processGreenCoffeeData([fullRow])[0];
}
