/**
 * Per-table column allowlists for filtering request bodies before Supabase writes.
 *
 * Use the allowlist pattern (safer than denylist) — new joins/computed fields are
 * automatically excluded. Add to a table's list only when the column actually exists
 * on that table in the database schema.
 */

export const SALES_COLUMNS = [
	'id',
	'user',
	'green_coffee_inv_id',
	'oz_sold',
	'price',
	'buyer',
	'batch_name',
	'sell_date',
	'purchase_date'
] as const;

export const GREEN_COFFEE_INV_COLUMNS = [
	'id',
	'rank',
	'notes',
	'purchase_date',
	'purchased_qty_lbs',
	'bean_cost',
	'tax_ship_cost',
	'last_updated',
	'user',
	'catalog_id',
	'stocked',
	'cupping_notes'
] as const;

/**
 * Pick only the keys present in `columns` from `data`.
 * Returns a new object with only the allowed fields.
 */
export function pickColumns<T extends Record<string, unknown>>(
	data: T,
	columns: readonly string[]
): Partial<T> {
	const allowed = new Set<string>(columns);
	return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k))) as Partial<T>;
}
