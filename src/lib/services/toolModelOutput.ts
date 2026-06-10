/**
 * Model-facing tool output compaction ("tool slimming").
 *
 * Tools stream their full output to the client — genUI blocks and the canvas
 * need complete rows — but the model does not. These helpers produce the
 * compact view the model sees via each tool's toModelOutput, dropping long
 * prose fields and UI-only payloads (e.g. action-card dropdown options).
 * Combined with server-side pruneMessages, this keeps per-request token cost
 * flat regardless of how much backend work the agent has done.
 */

const MAX_PROSE_CHARS = 240;

/** Catalog fields the model actually reasons over. */
const CATALOG_MODEL_FIELDS = [
	'id',
	'name',
	'source',
	'country',
	'region',
	'continent',
	'processing',
	'processing_base_method',
	'fermentation_type',
	'drying_method',
	'grade',
	'cultivar_detail',
	'type',
	'price_per_lb',
	'cost_lb',
	'score_value',
	'purveyor_score',
	'purveyor_score_tier',
	'purveyor_score_confidence',
	'purveyor_score_factors',
	'purveyor_score_version',
	'stocked',
	'stocked_date',
	'arrival_date',
	'wholesale',
	'rank',
	'rank_basis'
] as const;

/** Long prose fields kept in truncated form so the model can narrate flavor. */
const CATALOG_PROSE_FIELDS = ['description_short', 'cupping_notes'] as const;

function truncateProse(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.length > MAX_PROSE_CHARS ? `${trimmed.slice(0, MAX_PROSE_CHARS)}…` : trimmed;
}

export function compactCatalogRowForModel(row: Record<string, unknown>): Record<string, unknown> {
	const compact: Record<string, unknown> = {};

	for (const field of CATALOG_MODEL_FIELDS) {
		const value = row[field];
		if (value !== null && value !== undefined && value !== '') compact[field] = value;
	}

	for (const field of CATALOG_PROSE_FIELDS) {
		const truncated = truncateProse(row[field]);
		if (truncated) compact[field] = truncated;
	}

	return compact;
}

/**
 * Compact a coffee_catalog_search-style output ({ coffees: rows, ... }).
 * Non-row metadata (total, filters_applied, …) passes through unchanged.
 */
export function compactCatalogSearchOutputForModel(
	output: Record<string, unknown>
): Record<string, unknown> {
	if (!Array.isArray(output.coffees)) return output;
	return {
		...output,
		coffees: output.coffees.map((row) =>
			row && typeof row === 'object'
				? compactCatalogRowForModel(row as Record<string, unknown>)
				: row
		)
	};
}

/**
 * Compact an action-card proposal for the model: dropdown option lists and
 * hidden lookup fields are UI plumbing (the add-bean card carries hundreds of
 * select options) — the model only needs the proposed values.
 */
export function compactActionCardOutputForModel(
	output: Record<string, unknown>
): Record<string, unknown> {
	const card = output.action_card;
	if (!card || typeof card !== 'object') return output;

	const { fields, ...rest } = card as Record<string, unknown> & { fields?: unknown };
	const compactFields = Array.isArray(fields)
		? fields
				.filter(
					(field) =>
						!(field && typeof field === 'object' && (field as { type?: string }).type === 'hidden')
				)
				.map((field) => {
					if (!field || typeof field !== 'object') return field;
					const { key, label, value, type, editable } = field as Record<string, unknown>;
					return { key, label, value, type, editable };
				})
		: fields;

	return { ...output, action_card: { ...rest, fields: compactFields } };
}
