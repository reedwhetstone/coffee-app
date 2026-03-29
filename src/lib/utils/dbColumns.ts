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

export const ROAST_PROFILES_COLUMNS = [
	'roast_id',
	'user',
	'coffee_id',
	'coffee_name',
	'batch_name',
	'roast_date',
	'last_updated',
	'oz_in',
	'oz_out',
	'weight_loss_percent',
	'roast_notes',
	'roast_targets',
	'roaster_type',
	'roaster_size',
	'roast_uuid',
	'temperature_unit',
	'charge_time',
	'dry_end_time',
	'fc_start_time',
	'fc_end_time',
	'sc_start_time',
	'drop_time',
	'cool_time',
	'charge_temp',
	'dry_end_temp',
	'fc_start_temp',
	'fc_end_temp',
	'sc_start_temp',
	'drop_temp',
	'cool_temp',
	'tp_time',
	'tp_temp',
	'dry_percent',
	'maillard_percent',
	'development_percent',
	'total_roast_time',
	'auc',
	'total_ror',
	'dry_phase_ror',
	'mid_phase_ror',
	'finish_phase_ror',
	'dry_phase_delta_temp',
	'chart_x_min',
	'chart_x_max',
	'chart_y_min',
	'chart_y_max',
	'chart_z_min',
	'chart_z_max',
	'data_source'
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
