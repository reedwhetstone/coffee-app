/**
 * Inventory data layer — single source of truth for all green_coffee_inv queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - buildGreenCoffeeQuery / processGreenCoffeeData from greenCoffeeUtils are
 *    re-used here to avoid query duplication.
 *  - updateStockedStatus is the retained mutation helper used after roast and
 *    inventory changes.
 *  - Shared-data reads use Parchment contracts; this module retains the
 *    compatibility mutations that have not moved upstream yet.
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

export interface InventoryUpdateInput {
	rank?: number | null;
	notes?: string | null;
	purchase_date?: string | null;
	purchased_qty_lbs?: number | null;
	bean_cost?: number | null;
	tax_ship_cost?: number | null;
	last_updated?: string | null;
	user?: string | null;
	catalog_id?: number | null;
	stocked?: boolean | null;
	cupping_notes?: Database['public']['Tables']['green_coffee_inv']['Update']['cupping_notes'];
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

/**
 * Update an inventory item, verifying user ownership.
 * Returns the updated item with full catalog + roast profile joins.
 */
export async function updateInventory(
	supabase: SupabaseClient,
	id: number,
	userId: string,
	data: InventoryUpdateInput
) {
	// Verify ownership
	const { data: existing } = await supabase
		.from('green_coffee_inv')
		.select('user')
		.eq('id', id)
		.single();

	if (!existing || existing.user !== userId) {
		throw new Error('Unauthorized');
	}

	const { error: updateError } = await supabase
		.from('green_coffee_inv')
		.update(data as Database['public']['Tables']['green_coffee_inv']['Update'])
		.eq('id', id);

	if (updateError) throw updateError;

	// If purchased_qty_lbs changed and stocked wasn't manually set, auto-update
	// stocked status BEFORE the final fetch so the returned data is fresh
	if (data.purchased_qty_lbs !== undefined && data.stocked === undefined) {
		await updateStockedStatus(supabase, id, userId).catch((err) => {
			console.warn('Failed to auto-update stocked status after inventory update:', err);
		});
	}

	// Fetch with full joins — reflects any stocked status change above
	const { data: updatedRow } = await buildGreenCoffeeQuery(supabase).eq('id', id).single();

	return processGreenCoffeeData([updatedRow])[0];
}

/**
 * Update stocked status for a bean based on purchased quantity vs total oz roasted.
 * Retained here as part of the inventory mutation boundary.
 */
export async function updateStockedStatus(
	supabase: SupabaseClient,
	coffeeId: number,
	userId: string
): Promise<{
	success: boolean;
	stocked?: boolean;
	coffee_id?: number;
	remaining_oz?: number;
	error?: string;
}> {
	try {
		// Get the green coffee inventory record
		const { data: coffee, error: coffeeError } = await supabase
			.from('green_coffee_inv')
			.select('id, purchased_qty_lbs')
			.eq('id', coffeeId)
			.eq('user', userId)
			.single();

		if (coffeeError || !coffee) {
			console.error('Coffee not found for stocked status update:', coffeeId);
			return { success: false, error: 'Coffee not found' };
		}

		// Calculate total roasted quantity
		const { data: roastProfiles, error: roastError } = await supabase
			.from('roast_profiles')
			.select('oz_in')
			.eq('coffee_id', coffeeId)
			.eq('user', userId);

		if (roastError) {
			console.error('Error fetching roast profiles for stocked status update:', roastError);
			return { success: false, error: 'Error fetching roast profiles' };
		}

		// Calculate remaining quantity
		const totalOzIn =
			roastProfiles?.reduce(
				(sum: number, profile: { oz_in: number | null }) => sum + (profile.oz_in || 0),
				0
			) || 0;
		const purchasedOz = (coffee.purchased_qty_lbs || 0) * 16;
		const remainingOz = purchasedOz - totalOzIn;

		// Update stocked status: stocked if remaining quantity is at least 4 oz
		const shouldBeStocked = remainingOz >= 4;

		const { error: updateError } = await supabase
			.from('green_coffee_inv')
			.update({ stocked: shouldBeStocked })
			.eq('id', coffeeId)
			.eq('user', userId);

		if (updateError) {
			console.error('Error updating stocked status:', updateError);
			return { success: false, error: 'Error updating stocked status' };
		}

		return {
			success: true,
			stocked: shouldBeStocked,
			coffee_id: coffeeId,
			remaining_oz: remainingOz
		};
	} catch (error) {
		console.error('Error in updateStockedStatus:', error);
		return { success: false, error: 'Unexpected error' };
	}
}
