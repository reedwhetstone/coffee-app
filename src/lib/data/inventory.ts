/**
 * Inventory data layer — single source of truth for all green_coffee_inv queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - buildGreenCoffeeQuery / processGreenCoffeeData from greenCoffeeUtils are
 *    re-used here to avoid query duplication.
 *  - updateStockedStatus is absorbed from stockedStatusUtils.ts (which becomes
 *    a re-export shim for backwards compatibility).
 *  - getInventoryWithRoastSummary handles the GenUI tool's joined query; the
 *    route handler is responsible for reshaping into its response envelope.
 *  - deleteInventoryItem cascades to sales, roast_profiles (and their
 *    temps/events), then deletes the inventory row and optionally the
 *    user-owned catalog entry.
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

export interface InventoryListOptions {
	/** Filter to a single item by ID */
	id?: number;
	/** Filter to only stocked items */
	stockedOnly?: boolean;
	/** Max number of results */
	limit?: number;
	/** Order by field (default: purchase_date) */
	orderBy?: string;
	ascending?: boolean;
}

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

export interface InventoryWithSummaryOptions {
	stockedOnly?: boolean;
	includeCatalogDetails?: boolean;
	includeRoastSummary?: boolean;
	limit?: number;
}

export interface RoastSummary {
	total_roasts: number;
	total_oz_in: number;
	total_oz_out: number;
}

// Raw shape returned by the GenUI join query
export interface InventoryWithSummaryRow {
	id: number;
	purchased_qty_lbs?: number | null;
	bean_cost?: number | null;
	tax_ship_cost?: number | null;
	stocked: boolean | null;
	coffee_catalog?: {
		name?: string;
		arrival_date?: string | null;
		region?: string | null;
		processing?: string | null;
		drying_method?: string | null;
		lot_size?: string | null;
		bag_size?: string | null;
		packaging?: string | null;
		cultivar_detail?: string | null;
		grade?: string | null;
		appearance?: string | null;
		roast_recs?: string | null;
		type?: string | null;
		description_short?: string | null;
		description_long?: string | null;
		farm_notes?: string | null;
		link?: string | null;
		cost_lb?: number | null;
		price_per_lb?: number | null;
		source?: string | null;
		cupping_notes?: string | null;
		stocked?: boolean | null;
		stocked_date?: string | null;
		unstocked_date?: string | null;
		ai_description?: string | null;
		ai_tasting_notes?: Record<string, unknown> | null;
		public_coffee?: boolean | null;
		[key: string]: unknown;
	} | null;
	roast_summary?: RoastSummary;
	coffee_name?: string;
	[key: string]: unknown;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List inventory for a user, using the standard joined query (catalog + roast profiles).
 * Supports optional id filter, stocked filter, limit, and ordering.
 */
export async function listInventory(
	supabase: SupabaseClient,
	userId: string,
	options: InventoryListOptions = {}
) {
	let query = buildGreenCoffeeQuery(supabase).eq('user', userId);

	if (options.id !== undefined) {
		query = query.eq('id', options.id);
	}
	if (options.stockedOnly) {
		query = query.eq('stocked', true);
	}
	if (options.limit) {
		query = query.limit(options.limit);
	}

	const { data: rows, error } = await query;
	if (error) throw error;

	return processGreenCoffeeData(rows ?? []);
}

/**
 * Get a single inventory item by ID, verifying user ownership.
 * Returns null when not found or not owned by the user.
 */
export async function getInventoryItem(supabase: SupabaseClient, id: number, userId: string) {
	const { data, error } = await buildGreenCoffeeQuery(supabase)
		.eq('id', id)
		.eq('user', userId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') return null;
		throw error;
	}

	return processGreenCoffeeData([data])[0] ?? null;
}

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
 * Delete an inventory item, cascading to roast_profiles (and their temps/events),
 * then optionally the user-owned private catalog entry.
 *
 * Verifies user ownership before deleting.
 */
export async function deleteInventoryItem(
	supabase: SupabaseClient,
	id: number,
	userId: string
): Promise<void> {
	// Verify ownership and get catalog_id for potential cascade
	const { data: existing } = await supabase
		.from('green_coffee_inv')
		.select('user, catalog_id')
		.eq('id', id)
		.single();

	if (!existing || existing.user !== userId) {
		throw new Error('Unauthorized');
	}

	// Cascade-delete sales rows referencing this inventory item
	const { error: salesError } = await supabase.from('sales').delete().eq('green_coffee_inv_id', id);
	if (salesError) throw salesError;

	// Cascade-delete roast profiles: temps and events first, then profiles
	const { data: roastProfiles, error: selectError } = await supabase
		.from('roast_profiles')
		.select('roast_id')
		.eq('coffee_id', id);

	if (selectError) throw selectError;

	if (roastProfiles && roastProfiles.length > 0) {
		const roastIds = roastProfiles.map((p: { roast_id: number }) => p.roast_id);

		const { error: tempError } = await supabase
			.from('roast_temperatures')
			.delete()
			.in('roast_id', roastIds);
		if (tempError) throw tempError;

		const { error: eventError } = await supabase
			.from('roast_events')
			.delete()
			.in('roast_id', roastIds);
		if (eventError) throw eventError;

		const { error: profileError } = await supabase
			.from('roast_profiles')
			.delete()
			.eq('coffee_id', id);
		if (profileError) throw profileError;
	}

	// Delete the inventory row
	const { error: deleteError } = await supabase.from('green_coffee_inv').delete().eq('id', id);

	if (deleteError) throw deleteError;

	// Optionally cascade-delete the private user-owned catalog entry
	if (existing.catalog_id) {
		const { data: catalogEntry } = await supabase
			.from('coffee_catalog')
			.select('coffee_user, public_coffee')
			.eq('id', existing.catalog_id)
			.single();

		if (
			catalogEntry &&
			catalogEntry.coffee_user === userId &&
			catalogEntry.public_coffee === false
		) {
			const { error: catalogDeleteError } = await supabase
				.from('coffee_catalog')
				.delete()
				.eq('id', existing.catalog_id);

			if (catalogDeleteError) {
				console.error('Error deleting user-owned catalog entry:', catalogDeleteError);
				// Don't fail the whole operation if catalog deletion fails
			}
		}
	}
}

/**
 * Update stocked status for a bean based on purchased quantity vs total oz roasted.
 * Absorbed from stockedStatusUtils.ts (which now re-exports this function).
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

/**
 * Get inventory with roast summary data for the GenUI tool endpoint.
 * Returns raw rows; the route handler reshapes them into its response envelope.
 */
export async function getInventoryWithRoastSummary(
	supabase: SupabaseClient,
	userId: string,
	options: InventoryWithSummaryOptions = {}
): Promise<InventoryWithSummaryRow[]> {
	const {
		stockedOnly = true,
		includeRoastSummary = true,
		includeCatalogDetails = true,
		limit = 15
	} = options;

	let query = supabase
		.from('green_coffee_inv')
		.select(
			`
			*,
			coffee_catalog!catalog_id (
				name,
				arrival_date,
				continent,
				country,
				region,
				processing,
				drying_method,
				lot_size,
				bag_size,
				packaging,
				cultivar_detail,
				grade,
				appearance,
				roast_recs,
				type,
				description_short,
				description_long,
				farm_notes,
				link,
				cost_lb,
				price_per_lb,
				source,
				score_value,
				stocked,
				cupping_notes,
				stocked_date,
				unstocked_date,
				ai_description,
				ai_tasting_notes,
				public_coffee,
				wholesale,
				price_tiers
			)
		`
		)
		.eq('user', userId)
		.order('purchase_date', { ascending: false });

	if (stockedOnly !== false) {
		query = query.eq('stocked', true);
	}

	const finalLimit = Math.min(limit || 15, 15);
	if (finalLimit > 0) {
		query = query.limit(finalLimit);
	}

	const { data: inventoryData, error } = await query;

	if (error) throw error;

	let processedInventory = (inventoryData as unknown as InventoryWithSummaryRow[]) ?? [];

	// Optionally attach roast summary
	if (includeRoastSummary && processedInventory.length > 0) {
		const coffeeIds = processedInventory.map((bean) => bean.id);

		const { data: roastProfiles } = (await supabase
			.from('roast_profiles')
			.select('coffee_id, oz_in, oz_out, roast_id, batch_name, roast_date')
			.in('coffee_id', coffeeIds)
			.eq('user', userId)) as {
			data: Array<{
				coffee_id: number;
				oz_in: number | null;
				oz_out: number | null;
				roast_id: number;
				batch_name: string;
				roast_date: string;
			}> | null;
		};

		processedInventory = processedInventory.map((bean) => ({
			...bean,
			roast_summary: {
				total_roasts: roastProfiles?.filter((p) => p.coffee_id === bean.id).length || 0,
				total_oz_in:
					roastProfiles
						?.filter((p) => p.coffee_id === bean.id)
						.reduce((sum, p) => sum + (p.oz_in || 0), 0) || 0,
				total_oz_out:
					roastProfiles
						?.filter((p) => p.coffee_id === bean.id)
						.reduce((sum, p) => sum + (p.oz_out || 0), 0) || 0
			}
		}));
	}

	// Optionally strip catalog details, retaining only the coffee name
	if (!includeCatalogDetails) {
		processedInventory = processedInventory.map((bean) => {
			const { coffee_catalog, ...beanWithoutCatalog } = bean;
			return {
				...beanWithoutCatalog,
				coffee_name: coffee_catalog?.name || 'Unknown'
			};
		});
	}

	return processedInventory;
}
