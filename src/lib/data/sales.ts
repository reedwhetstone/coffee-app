/**
 * Sales data layer — single source of truth for all sales and profit queries.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - listSales returns enriched sale rows with coffee_name joined from catalog.
 *  - getProfitData returns per-inventory-item profit calculations.
 *  - recordSale / updateSale / deleteSale are thin wrappers that do ownership
 *    verification at the route layer, not here. The route handler must confirm
 *    ownership before calling mutating functions.
 *  - All response shapes are identical to what the original route handlers
 *    returned to preserve wire-compatibility.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// ── Internal query types ──────────────────────────────────────────────────────

type CoffeeCatalogName = { name: string };
type GreenCoffeeWithCatalog = Database['public']['Tables']['green_coffee_inv']['Row'] & {
	coffee_catalog: CoffeeCatalogName | CoffeeCatalogName[] | null;
};

/** Raw row returned by the sales join query. */
type SaleWithDetails = Database['public']['Tables']['sales']['Row'] & {
	green_coffee_inv: GreenCoffeeWithCatalog | null;
};

/** Raw row returned by the profit join query. */
type ProfitDataRow = Database['public']['Tables']['green_coffee_inv']['Row'] & {
	coffee_catalog: CoffeeCatalogName | CoffeeCatalogName[] | null;
	sales: { price: number | null; oz_sold: number | null }[];
	roast_profiles: { oz_in: number | null; oz_out: number | null }[];
};

// ── Public output types ───────────────────────────────────────────────────────

/** Enriched sale row as returned by listSales. */
export type Sale = Database['public']['Tables']['sales']['Row'] & {
	coffee_name: string | null;
};

/** Per-inventory-item profit summary as returned by getProfitData. */
export interface ProfitItem {
	id: number;
	coffee_name: string | undefined;
	purchase_date: string | undefined;
	purchased_qty_lbs: number | null;
	purchased_qty_oz: number;
	bean_cost: number | null;
	tax_ship_cost: number | null;
	total_sales: number;
	oz_sold: number;
	profit: number;
	oz_in: number;
	oz_out: number;
	profit_margin: number;
}

// ── Input types ───────────────────────────────────────────────────────────────

export type SaleCreateInput = Omit<
	Database['public']['Tables']['sales']['Insert'],
	'user' | 'id'
> & { green_coffee_inv_id: number };

export type SaleUpdateInput = Database['public']['Tables']['sales']['Update'];

// ── Query functions ───────────────────────────────────────────────────────────

/**
 * List all sales for a user, enriched with the linked coffee name.
 * Results are ordered by sell_date descending.
 */
export async function listSales(supabase: SupabaseClient, userId: string): Promise<Sale[]> {
	const { data: salesRaw, error: salesError } = await supabase
		.from('sales')
		.select(
			`
			*,
			green_coffee_inv!inner (
				id,
				catalog_id,
				coffee_catalog!catalog_id (
					name
				)
			)
		`
		)
		.eq('user', userId)
		.order('sell_date', { ascending: false });

	if (salesError) {
		throw new Error(salesError.message);
	}

	const sales = (salesRaw ?? []) as unknown as SaleWithDetails[];

	return sales.map((sale) => {
		const catalog = sale.green_coffee_inv?.coffee_catalog;
		const coffeeName = Array.isArray(catalog)
			? catalog[0]?.name
			: (catalog as { name: string })?.name;

		return {
			...sale,
			coffee_name: coffeeName || null
		};
	});
}

/**
 * Return per-inventory-item profit calculations for a user.
 * Results are ordered by purchase_date descending.
 */
export async function getProfitData(
	supabase: SupabaseClient,
	userId: string
): Promise<ProfitItem[]> {
	const { data: profitDataRaw, error: profitError } = await supabase
		.from('green_coffee_inv')
		.select(
			`
			id,
			purchase_date,
			purchased_qty_lbs,
			bean_cost,
			tax_ship_cost,
			catalog_id,
			coffee_catalog!catalog_id (
				name,
				score_value,
				arrival_date,
				region,
				processing,
				cultivar_detail,
				cost_lb,
				source,
				stocked
			),
			sales(
				price,
				oz_sold
			),
			roast_profiles(
				oz_in,
				oz_out
			)
		`
		)
		.eq('user', userId)
		.order('purchase_date', { ascending: false });

	if (profitError) {
		throw new Error(profitError.message);
	}

	const profitData = (profitDataRaw ?? []) as unknown as ProfitDataRow[];

	return profitData.map((row) => {
		const totalSales = row.sales?.reduce((sum, sale) => sum + (sale.price || 0), 0) || 0;
		const totalOzSold = row.sales?.reduce((sum, sale) => sum + (sale.oz_sold || 0), 0) || 0;
		const totalOzIn =
			row.roast_profiles?.reduce((sum, profile) => sum + (profile.oz_in || 0), 0) || 0;
		const totalOzOut =
			row.roast_profiles?.reduce((sum, profile) => sum + (profile.oz_out || 0), 0) || 0;
		const totalCost = (row.bean_cost || 0) + (row.tax_ship_cost || 0);
		const profit = totalSales - totalCost;
		const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

		const displayName = Array.isArray(row.coffee_catalog)
			? row.coffee_catalog[0]?.name
			: row.coffee_catalog?.name;

		return {
			id: row.id,
			coffee_name: displayName,
			purchase_date: row.purchase_date?.split('T')[0],
			purchased_qty_lbs: row.purchased_qty_lbs,
			purchased_qty_oz: (row.purchased_qty_lbs || 0) * 16,
			bean_cost: row.bean_cost,
			tax_ship_cost: row.tax_ship_cost,
			total_sales: totalSales,
			oz_sold: totalOzSold,
			profit: profit,
			oz_in: totalOzIn,
			oz_out: totalOzOut,
			profit_margin: profitMargin
		};
	});
}

/**
 * Record a new sale. The caller must verify that userId owns the
 * green_coffee_inv_id before calling this function.
 *
 * Returns the created sale enriched with coffee_name and purchase_date
 * (matches the original POST response shape).
 */
export async function recordSale(
	supabase: SupabaseClient,
	userId: string,
	data: SaleCreateInput
): Promise<Sale & { purchase_date?: string | null }> {
	const { data: newSale, error: insertError } = await supabase
		.from('sales')
		.insert({ ...data, user: userId } as Database['public']['Tables']['sales']['Insert'])
		.select()
		.single();

	if (insertError) {
		throw new Error(insertError.message);
	}

	// Fetch coffee name for the response (preserves original POST shape)
	const { data: coffeeDataRaw } = await supabase
		.from('green_coffee_inv')
		.select(
			`
			purchase_date,
			coffee_catalog!catalog_id (
				name
			)
		`
		)
		.eq('id', data.green_coffee_inv_id)
		.single();

	const coffeeData = coffeeDataRaw as unknown as GreenCoffeeWithCatalog;

	return {
		...newSale,
		coffee_name: Array.isArray(coffeeData?.coffee_catalog)
			? (coffeeData?.coffee_catalog[0] as { name: string })?.name || null
			: (coffeeData?.coffee_catalog as { name: string })?.name || null,
		purchase_date: coffeeData?.purchase_date || null
	};
}

/**
 * Update an existing sale. The caller must verify ownership before calling.
 * Returns the updated sale row.
 */
export async function updateSale(
	supabase: SupabaseClient,
	id: number,
	userId: string,
	data: SaleUpdateInput
): Promise<Database['public']['Tables']['sales']['Row']> {
	const { data: updated, error } = await supabase
		.from('sales')
		.update(data as Database['public']['Tables']['sales']['Update'])
		.eq('id', id)
		.eq('user', userId)
		.select()
		.single();

	if (error) {
		throw new Error(error.message);
	}

	return updated;
}

/**
 * Delete a sale. The caller must verify ownership before calling.
 */
export async function deleteSale(
	supabase: SupabaseClient,
	id: number,
	userId: string
): Promise<void> {
	const { error } = await supabase.from('sales').delete().eq('id', id).eq('user', userId);

	if (error) {
		throw new Error(error.message);
	}
}
