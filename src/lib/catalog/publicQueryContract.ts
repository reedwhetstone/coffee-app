export const PUBLIC_CATALOG_SORT_FIELDS = [
	'arrival_date',
	'stocked_date',
	'name',
	'source',
	'continent',
	'country',
	'region',
	'processing',
	'cultivar_detail',
	'type',
	'grade',
	'appearance',
	'score_value',
	'cost_lb',
	'price_per_lb'
] as const;

export type PublicCatalogSortField = (typeof PUBLIC_CATALOG_SORT_FIELDS)[number];

export const PUBLIC_CATALOG_FIELD_VALUES = ['full', 'dropdown'] as const;
export const PUBLIC_CATALOG_STOCKED_VALUES = ['true', 'false', 'all'] as const;
export const PUBLIC_CATALOG_BOOLEAN_VALUES = ['true', 'false'] as const;

export function formatAllowedValues(values: readonly string[]): string {
	if (values.length === 0) {
		return '';
	}

	if (values.length === 1) {
		return values[0];
	}

	if (values.length === 2) {
		return `${values[0]} or ${values[1]}`;
	}

	return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`;
}
