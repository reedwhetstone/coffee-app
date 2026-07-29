/**
 * Deferred direct-Supabase profit-summary data layer.
 *
 * Sales reads and mutations use the Parchment SDK through
 * src/lib/server/parchmentSales.ts. The joined profit summary remains here
 * until Parchment exposes its canonical replacement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// ── Internal query types ──────────────────────────────────────────────────────

type CoffeeCatalogName = { name: string; wholesale?: boolean };
/** Raw row returned by the profit join query. */
type ProfitDataRow = Database['public']['Tables']['green_coffee_inv']['Row'] & {
	coffee_catalog: CoffeeCatalogName | CoffeeCatalogName[] | null;
	sales: { price: number | null; oz_sold: number | null }[];
	roast_profiles: { oz_in: number | null; oz_out: number | null }[];
};

// ── Public output types ───────────────────────────────────────────────────────

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
	wholesale: boolean;
}

// ── Query functions ───────────────────────────────────────────────────────────

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
				stocked,
				wholesale
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
		const wholesale = Array.isArray(row.coffee_catalog)
			? row.coffee_catalog[0]?.wholesale
			: row.coffee_catalog?.wholesale;

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
			profit_margin: profitMargin,
			wholesale: wholesale ?? false
		};
	});
}
