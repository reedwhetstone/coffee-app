export type CatalogQueryValue = string | string[] | number | number[];

function normalizeParchmentValue(key: string, value: CatalogQueryValue): CatalogQueryValue {
	// The generated catalog contract accepts coffeeIds as one comma-separated
	// string. Repeated query params are treated as an invalid scalar upstream and
	// silently lose the ID constraint in lenient website mode.
	if (key === 'coffeeIds' && Array.isArray(value)) return value.join(',');
	return value;
}

/**
 * The app keeps stable, snake_case catalog URLs for shareability while the
 * canonical Parchment SDK uses its generated camelCase query contract. Keep
 * that translation at the API boundary so SSR and in-page BFF refreshes send
 * identical upstream requests.
 */
const APP_TO_PARCHMENT_QUERY_KEY: Readonly<Record<string, string>> = {
	sortField: 'sort',
	sortDirection: 'order',
	cultivar_detail: 'variety',
	score_value_min: 'scoreValueMin',
	score_value_max: 'scoreValueMax',
	price_per_lb_min: 'pricePerLbMin',
	price_per_lb_max: 'pricePerLbMax',
	cost_lb_min: 'pricePerLbMin',
	cost_lb_max: 'pricePerLbMax',
	arrival_date: 'arrivalDate',
	stocked_date: 'stockedDate',
	stocked_days: 'stockedDays',
	ids: 'coffeeIds'
};

export function toParchmentCatalogQuery(
	input: Record<string, CatalogQueryValue>
): Record<string, CatalogQueryValue> {
	const query: Record<string, CatalogQueryValue> = {};

	// Preserve explicit canonical params when a caller supplies both forms.
	for (const [key, value] of Object.entries(input)) {
		if (!(key in APP_TO_PARCHMENT_QUERY_KEY)) query[key] = normalizeParchmentValue(key, value);
	}

	for (const [key, value] of Object.entries(input)) {
		const upstreamKey = APP_TO_PARCHMENT_QUERY_KEY[key];
		if (upstreamKey && !(upstreamKey in query)) {
			query[upstreamKey] = normalizeParchmentValue(upstreamKey, value);
		}
	}

	return query;
}
