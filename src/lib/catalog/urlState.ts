export type CatalogFilterValue =
	| string
	| number
	| boolean
	| { min: string | number; max: string | number }
	| string[]
	| null;

export interface CatalogUrlState {
	filters: Record<string, CatalogFilterValue>;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	showWholesale: boolean;
	pagination: {
		page: number;
		limit: number;
	};
}

export interface CatalogSearchState {
	origin?: string;
	continent?: string;
	country?: string | string[];
	source?: string[];
	processing?: string;
	processingBaseMethod?: string;
	fermentationType?: string;
	processAdditive?: string;
	processingDisclosureLevel?: string;
	processingConfidenceMin?: number;
	cultivarDetail?: string;
	type?: string;
	grade?: string;
	appearance?: string;
	name?: string;
	region?: string;
	scoreValueMin?: number;
	scoreValueMax?: number;
	pricePerLbMin?: number;
	pricePerLbMax?: number;
	arrivalDate?: string;
	stockedDate?: string;
	orderBy?: string;
	orderDirection?: 'asc' | 'desc';
	limit: number;
	offset: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 15;
const DEFAULT_CATALOG_SORT = {
	field: null,
	direction: null
} as const;

const RANGE_FILTER_KEYS = new Set(['score_value', 'cost_lb']);
const MULTI_VALUE_FILTER_KEYS = new Set(['country', 'source']);
const STRING_FILTER_KEYS = [
	'origin',
	'continent',
	'processing',
	'processing_base_method',
	'fermentation_type',
	'process_additive',
	'processing_disclosure_level',
	'cultivar_detail',
	'type',
	'grade',
	'appearance',
	'name',
	'region',
	'arrival_date',
	'stocked_date'
] as const;
const FILTER_SERIALIZATION_ORDER = [
	'origin',
	'continent',
	'country',
	'source',
	'processing',
	'processing_base_method',
	'fermentation_type',
	'process_additive',
	'processing_disclosure_level',
	'processing_confidence_min',
	'cultivar_detail',
	'type',
	'grade',
	'appearance',
	'name',
	'region',
	'score_value',
	'cost_lb',
	'arrival_date',
	'stocked_date'
] as const;

export const PROCESSING_CONFIDENCE_OPTIONS = [
	{ value: 0.6, label: 'Moderate confidence' },
	{ value: 0.8, label: 'High confidence' },
	{ value: 0.9, label: 'Very high confidence' }
] as const;

const SUPPORTED_PROCESSING_CONFIDENCE_THRESHOLDS = new Set<number>(
	PROCESSING_CONFIDENCE_OPTIONS.map((option) => option.value)
);

function parsePositiveInteger(value: string | null, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(value: string | null): number | undefined {
	if (!value) return undefined;

	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProcessingConfidenceMin(value: string | null): number | undefined {
	const parsed = parseOptionalNumber(value);
	if (parsed === undefined || !SUPPORTED_PROCESSING_CONFIDENCE_THRESHOLDS.has(parsed)) {
		return undefined;
	}

	return parsed;
}

function parseOptionalNumberFromAliases(
	searchParams: URLSearchParams,
	...paramNames: string[]
): number | undefined {
	for (const paramName of paramNames) {
		const parsed = parseOptionalNumber(searchParams.get(paramName));
		if (parsed !== undefined) {
			return parsed;
		}
	}

	return undefined;
}

function getParamName(filterKey: string): string {
	return filterKey === 'cost_lb' ? 'price_per_lb' : filterKey;
}

export function getCatalogDefaultSort(routeId: string) {
	if (routeId === '/' || routeId === '' || routeId.includes('/catalog')) {
		return DEFAULT_CATALOG_SORT;
	}

	return {
		field: null,
		direction: null
	} as const;
}

export function parseCatalogUrlState(url: URL, routeId = '/catalog'): CatalogUrlState {
	const defaultSort = getCatalogDefaultSort(routeId);
	const filters: Record<string, CatalogFilterValue> = {};

	for (const key of STRING_FILTER_KEYS) {
		const value = url.searchParams.get(key);
		if (value) {
			filters[key] = value;
		}
	}

	for (const key of MULTI_VALUE_FILTER_KEYS) {
		const values = url.searchParams.getAll(key).filter(Boolean);
		if (values.length > 0) {
			filters[key] = values;
		}
	}

	const scoreValueMin = parseOptionalNumber(url.searchParams.get('score_value_min'));
	const scoreValueMax = parseOptionalNumber(url.searchParams.get('score_value_max'));
	if (scoreValueMin !== undefined || scoreValueMax !== undefined) {
		filters.score_value = {
			min: scoreValueMin?.toString() ?? '',
			max: scoreValueMax?.toString() ?? ''
		};
	}

	const pricePerLbMin = parseOptionalNumberFromAliases(
		url.searchParams,
		'price_per_lb_min',
		'cost_lb_min'
	);
	const pricePerLbMax = parseOptionalNumberFromAliases(
		url.searchParams,
		'price_per_lb_max',
		'cost_lb_max'
	);
	if (pricePerLbMin !== undefined || pricePerLbMax !== undefined) {
		filters.cost_lb = {
			min: pricePerLbMin?.toString() ?? '',
			max: pricePerLbMax?.toString() ?? ''
		};
	}

	const processingConfidenceMin = parseProcessingConfidenceMin(
		url.searchParams.get('processing_confidence_min')
	);
	if (processingConfidenceMin !== undefined) {
		filters.processing_confidence_min = processingConfidenceMin;
	}

	const sortField = url.searchParams.get('sortField') ?? defaultSort.field;
	const sortDirectionParam = url.searchParams.get('sortDirection');
	const sortDirection =
		sortDirectionParam === 'asc' || sortDirectionParam === 'desc'
			? sortDirectionParam
			: sortField
				? 'desc'
				: defaultSort.direction;

	return {
		filters,
		sortField,
		sortDirection,
		showWholesale: url.searchParams.get('showWholesale') === 'true',
		pagination: {
			page: parsePositiveInteger(url.searchParams.get('page'), DEFAULT_PAGE),
			limit: parsePositiveInteger(url.searchParams.get('limit'), DEFAULT_LIMIT)
		}
	};
}

function appendFilterParam(
	params: URLSearchParams,
	filterKey: string,
	value: CatalogFilterValue
): void {
	if (value === undefined || value === null || value === '') {
		return;
	}

	const paramKey = getParamName(filterKey);

	if (Array.isArray(value)) {
		for (const item of value) {
			if (item) {
				params.append(paramKey, item.toString());
			}
		}
		return;
	}

	if (
		typeof value === 'object' &&
		value !== null &&
		'min' in value &&
		'max' in value &&
		RANGE_FILTER_KEYS.has(filterKey)
	) {
		if (value.min !== '') {
			params.append(`${paramKey}_min`, value.min.toString());
		}
		if (value.max !== '') {
			params.append(`${paramKey}_max`, value.max.toString());
		}
		return;
	}

	if (filterKey === 'processing_confidence_min') {
		const threshold = parseProcessingConfidenceMin(value.toString());
		if (threshold !== undefined) {
			params.append(paramKey, threshold.toString());
		}
		return;
	}

	params.append(paramKey, value.toString());
}

function buildCatalogQueryParams(
	state: CatalogUrlState,
	routeId: string,
	options: {
		includeDefaultPagination: boolean;
		includeDefaultSort: boolean;
	}
): URLSearchParams {
	const params = new URLSearchParams();
	const defaultSort = getCatalogDefaultSort(routeId);

	if (options.includeDefaultPagination || state.pagination.page !== DEFAULT_PAGE) {
		params.append('page', state.pagination.page.toString());
	}
	if (options.includeDefaultPagination || state.pagination.limit !== DEFAULT_LIMIT) {
		params.append('limit', state.pagination.limit.toString());
	}

	if (state.sortField) {
		const isDefaultSort =
			state.sortField === defaultSort.field && state.sortDirection === defaultSort.direction;
		if (options.includeDefaultSort || !isDefaultSort) {
			params.append('sortField', state.sortField);
			if (state.sortDirection) {
				params.append('sortDirection', state.sortDirection);
			}
		}
	}

	if (state.showWholesale) {
		params.append('showWholesale', 'true');
	}

	for (const filterKey of FILTER_SERIALIZATION_ORDER) {
		if (filterKey in state.filters) {
			appendFilterParam(params, filterKey, state.filters[filterKey]);
		}
	}

	const remainingFilterKeys = Object.keys(state.filters)
		.filter((filterKey) => !FILTER_SERIALIZATION_ORDER.includes(filterKey as never))
		.sort();
	for (const filterKey of remainingFilterKeys) {
		appendFilterParam(params, filterKey, state.filters[filterKey]);
	}

	return params;
}

export function createDefaultCatalogUrlState(routeId = '/catalog'): CatalogUrlState {
	const defaultSort = getCatalogDefaultSort(routeId);
	return {
		filters: {},
		sortField: defaultSort.field,
		sortDirection: defaultSort.direction,
		showWholesale: false,
		pagination: {
			page: DEFAULT_PAGE,
			limit: DEFAULT_LIMIT
		}
	};
}

export function buildCatalogRequestParams(
	state: CatalogUrlState,
	routeId = '/catalog'
): URLSearchParams {
	return buildCatalogQueryParams(state, routeId, {
		includeDefaultPagination: true,
		includeDefaultSort: true
	});
}

export function buildCatalogShareParams(
	state: CatalogUrlState,
	routeId = '/catalog'
): URLSearchParams {
	return buildCatalogQueryParams(state, routeId, {
		includeDefaultPagination: false,
		includeDefaultSort: false
	});
}

export function buildCatalogUrlSearchParams(
	state: CatalogUrlState,
	routeId = '/catalog'
): URLSearchParams {
	return buildCatalogRequestParams(state, routeId);
}

function readRangeValue(
	value: CatalogFilterValue | undefined
): { min?: number; max?: number } | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	const min = parseOptionalNumber(value.min?.toString() ?? null);
	const max = parseOptionalNumber(value.max?.toString() ?? null);
	if (min === undefined && max === undefined) {
		return undefined;
	}

	return { min, max };
}

function readStringValue(value: CatalogFilterValue | undefined): string | undefined {
	if (typeof value === 'string' && value !== '') {
		return value;
	}

	return undefined;
}

function readArrayValue(value: CatalogFilterValue | undefined): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const values = value.map((entry) => entry.toString()).filter(Boolean);
	return values.length > 0 ? values : undefined;
}

export function catalogUrlStateToSearchState(state: CatalogUrlState): CatalogSearchState {
	const scoreRange = readRangeValue(state.filters.score_value);
	const priceRange = readRangeValue(state.filters.cost_lb);
	const countries = readArrayValue(state.filters.country);

	return {
		origin: readStringValue(state.filters.origin),
		continent: readStringValue(state.filters.continent),
		country: countries && countries.length === 1 ? countries[0] : countries,
		source: readArrayValue(state.filters.source),
		processing: readStringValue(state.filters.processing),
		processingBaseMethod: readStringValue(state.filters.processing_base_method),
		fermentationType: readStringValue(state.filters.fermentation_type),
		processAdditive: readStringValue(state.filters.process_additive),
		processingDisclosureLevel: readStringValue(state.filters.processing_disclosure_level),
		processingConfidenceMin: parseProcessingConfidenceMin(
			state.filters.processing_confidence_min?.toString() ?? null
		),
		cultivarDetail: readStringValue(state.filters.cultivar_detail),
		type: readStringValue(state.filters.type),
		grade: readStringValue(state.filters.grade),
		appearance: readStringValue(state.filters.appearance),
		name: readStringValue(state.filters.name),
		region: readStringValue(state.filters.region),
		scoreValueMin: scoreRange?.min,
		scoreValueMax: scoreRange?.max,
		pricePerLbMin: priceRange?.min,
		pricePerLbMax: priceRange?.max,
		arrivalDate: readStringValue(state.filters.arrival_date),
		stockedDate: readStringValue(state.filters.stocked_date),
		orderBy: state.sortField ?? undefined,
		orderDirection: state.sortDirection ?? undefined,
		limit: state.pagination.limit,
		offset: (state.pagination.page - 1) * state.pagination.limit
	};
}
