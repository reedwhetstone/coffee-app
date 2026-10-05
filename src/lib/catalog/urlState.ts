export type CatalogFilterValue =
	| string
	| number
	| boolean
	| { min: string | number; max: string | number; includeUnknown?: boolean }
	| string[]
	| null;

export interface CatalogUrlState {
	filters: Record<string, CatalogFilterValue>;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	showWholesale: boolean;
	wholesaleOnly: boolean;
	/** True when the view also lists coffees that are no longer in stock. */
	includeUnstocked?: boolean;
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
	hasAdditives?: boolean;
	processingDisclosureLevel?: string;
	processingConfidenceMin?: number;
	dryingMethodCodes?: string[];
	varietyCodes?: string[];
	speciesCodes?: string[];
	gradeCodes?: string[];
	peaberry?: boolean;
	labAnalyzed?: boolean;
	screenMin?: number;
	screenMax?: number;
	includeUnknownScreen?: boolean;
	moistureMax?: number;
	scoreProtocol?: string;
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
	elevationMinMasl?: number;
	elevationMaxMasl?: number;
	includeUnknownElevation?: boolean;
	arrivalDate?: string;
	stockedDate?: string;
	stockedDays?: number;
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

const RANGE_FILTER_PARAM_NAMES: Readonly<Record<string, { min: string; max: string }>> = {
	score_value: { min: 'score_value_min', max: 'score_value_max' },
	cost_lb: { min: 'price_per_lb_min', max: 'price_per_lb_max' },
	elevation_masl: { min: 'elevation_min_masl', max: 'elevation_max_masl' },
	screen_size: { min: 'screen_min', max: 'screen_max' }
};
/** A range whose "include coffees with no stated value" choice has its own param. */
const RANGE_INCLUDE_UNKNOWN_PARAM: Readonly<Record<string, string>> = {
	elevation_masl: 'include_unknown_elevation',
	screen_size: 'include_unknown_screen'
};
const RANGE_FILTER_KEYS = new Set(Object.keys(RANGE_FILTER_PARAM_NAMES));
/**
 * Standardized variety, species and drying filters (ADR-018). Each holds
 * vocabulary codes; a coffee matches when it carries any selected code.
 */
export const TAXONOMY_CODE_FILTER_KEYS = [
	'variety_code',
	'species_code',
	'drying_method_code'
] as const;
/**
 * Green coffee grading filters (ADR-016): grade designations, the peaberry and
 * lab-analyzed facts, screen size, moisture, and the cup score's protocol.
 */
export const GRADING_FILTER_KEYS = [
	'grade_code',
	'peaberry',
	'lab_analyzed',
	'screen_size',
	'moisture_max',
	'score_protocol'
] as const;
/** The cup score protocols Parchment recognizes; a score with none stated is `supplier_unspecified`. */
export const SCORE_PROTOCOLS = [
	'sca_2004',
	'cva_affective',
	'q_arabica',
	'coe',
	'supplier_unspecified'
] as const;
const SCREEN_SIZE_MIN = 8;
const SCREEN_SIZE_MAX = 20;
const MULTI_VALUE_FILTER_KEYS = new Set([
	'country',
	'source',
	...TAXONOMY_CODE_FILTER_KEYS,
	'grade_code'
]);
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
	'has_additives',
	'processing_disclosure_level',
	'processing_confidence_min',
	'drying_method_code',
	'variety_code',
	'species_code',
	'grade_code',
	'peaberry',
	'lab_analyzed',
	'screen_size',
	'moisture_max',
	'cultivar_detail',
	'type',
	'grade',
	'appearance',
	'name',
	'region',
	'score_value',
	'score_protocol',
	'cost_lb',
	'elevation_masl',
	'arrival_date',
	'stocked_date',
	'stocked_days'
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

function parseStrictBoolean(value: string | null): boolean | undefined {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return undefined;
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
		// A link may repeat a value; a selection holds each value once.
		const values = [...new Set(url.searchParams.getAll(key).filter(Boolean))];
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

	const elevationMinMasl = parseOptionalNumber(url.searchParams.get('elevation_min_masl'));
	const elevationMaxMasl = parseOptionalNumber(url.searchParams.get('elevation_max_masl'));
	if (elevationMinMasl !== undefined || elevationMaxMasl !== undefined) {
		filters.elevation_masl = {
			min: elevationMinMasl?.toString() ?? '',
			max: elevationMaxMasl?.toString() ?? '',
			...(url.searchParams.get('include_unknown_elevation') === 'true'
				? { includeUnknown: true }
				: {})
		};
	}

	// Grade codes are upper case ("KE:AA"); a link typed by hand may not be.
	if (Array.isArray(filters.grade_code)) {
		filters.grade_code = [...new Set(filters.grade_code.map((code) => code.toUpperCase()))];
	}
	for (const key of ['peaberry', 'lab_analyzed'] as const) {
		// These narrow to coffees that state the fact; there is no "false" form.
		if (url.searchParams.get(key) === 'true') filters[key] = true;
	}
	const screenSize = (param: string) => {
		const value = parseOptionalNumber(url.searchParams.get(param));
		return value !== undefined &&
			Number.isInteger(value) &&
			value >= SCREEN_SIZE_MIN &&
			value <= SCREEN_SIZE_MAX
			? value
			: undefined;
	};
	const screenMin = screenSize('screen_min');
	const screenMax = screenSize('screen_max');
	// An inverted pair is dropped whole, as Parchment does.
	if (
		(screenMin !== undefined || screenMax !== undefined) &&
		!(screenMin !== undefined && screenMax !== undefined && screenMin > screenMax)
	) {
		filters.screen_size = {
			min: screenMin?.toString() ?? '',
			max: screenMax?.toString() ?? '',
			...(url.searchParams.get('include_unknown_screen') === 'true' ? { includeUnknown: true } : {})
		};
	}
	const moistureMax = parseOptionalNumber(url.searchParams.get('moisture_max'));
	if (moistureMax !== undefined && moistureMax > 0) {
		filters.moisture_max = moistureMax;
	}
	const scoreProtocol = url.searchParams.get('score_protocol')?.toLowerCase();
	if (scoreProtocol && (SCORE_PROTOCOLS as readonly string[]).includes(scoreProtocol)) {
		filters.score_protocol = scoreProtocol;
	}

	const processingConfidenceMin = parseProcessingConfidenceMin(
		url.searchParams.get('processing_confidence_min')
	);
	if (processingConfidenceMin !== undefined) {
		filters.processing_confidence_min = processingConfidenceMin;
	}

	const hasAdditives = parseStrictBoolean(url.searchParams.get('has_additives'));
	if (hasAdditives !== undefined) {
		filters.has_additives = hasAdditives;
	}

	const stockedDays = parsePositiveInteger(url.searchParams.get('stocked_days'), 0);
	if (stockedDays > 0) {
		filters.stocked_days = stockedDays;
	}

	const sortField = url.searchParams.get('sortField') ?? defaultSort.field;
	const sortDirectionParam = url.searchParams.get('sortDirection');
	const sortDirection =
		sortDirectionParam === 'asc' || sortDirectionParam === 'desc'
			? sortDirectionParam
			: sortField
				? 'desc'
				: defaultSort.direction;
	const wholesaleOnly = url.searchParams.get('wholesaleOnly') === 'true';

	return {
		filters,
		sortField,
		sortDirection,
		showWholesale: wholesaleOnly || url.searchParams.get('showWholesale') !== 'false',
		wholesaleOnly,
		...(url.searchParams.get('stocked') === 'all' ? { includeUnstocked: true } : {}),
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
		const rangeParamNames = RANGE_FILTER_PARAM_NAMES[filterKey];
		if (value.min !== '') {
			params.append(rangeParamNames.min, value.min.toString());
		}
		if (value.max !== '') {
			params.append(rangeParamNames.max, value.max.toString());
		}
		const includeUnknownParam = RANGE_INCLUDE_UNKNOWN_PARAM[filterKey];
		if (includeUnknownParam && value.includeUnknown === true) {
			params.append(includeUnknownParam, 'true');
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

	if (filterKey === 'has_additives') {
		if (typeof value === 'boolean') {
			params.append(paramKey, value.toString());
		}
		return;
	}

	if (filterKey === 'peaberry' || filterKey === 'lab_analyzed') {
		if (value === true) params.append(paramKey, 'true');
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

	if (!state.showWholesale && !state.wholesaleOnly) {
		params.append('showWholesale', 'false');
	}
	if (state.wholesaleOnly) {
		params.append('showWholesale', 'true');
		params.append('wholesaleOnly', 'true');
	}
	if (state.includeUnstocked) {
		params.append('stocked', 'all');
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
		showWholesale: true,
		wholesaleOnly: false,
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

function readBooleanValue(value: CatalogFilterValue | undefined): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function readIncludeUnknown(value: CatalogFilterValue | undefined): boolean | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	return value.includeUnknown === true ? true : undefined;
}

export function catalogUrlStateToSearchState(state: CatalogUrlState): CatalogSearchState {
	const scoreRange = readRangeValue(state.filters.score_value);
	const priceRange = readRangeValue(state.filters.cost_lb);
	const elevationRange = readRangeValue(state.filters.elevation_masl);
	const screenRange = readRangeValue(state.filters.screen_size);
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
		hasAdditives: readBooleanValue(state.filters.has_additives),
		processingDisclosureLevel: readStringValue(state.filters.processing_disclosure_level),
		processingConfidenceMin: parseProcessingConfidenceMin(
			state.filters.processing_confidence_min?.toString() ?? null
		),
		dryingMethodCodes: readArrayValue(state.filters.drying_method_code),
		varietyCodes: readArrayValue(state.filters.variety_code),
		speciesCodes: readArrayValue(state.filters.species_code),
		gradeCodes: readArrayValue(state.filters.grade_code),
		peaberry: state.filters.peaberry === true ? true : undefined,
		labAnalyzed: state.filters.lab_analyzed === true ? true : undefined,
		screenMin: screenRange?.min,
		screenMax: screenRange?.max,
		includeUnknownScreen: screenRange ? readIncludeUnknown(state.filters.screen_size) : undefined,
		moistureMax: parseOptionalNumber(state.filters.moisture_max?.toString() ?? null),
		scoreProtocol: readStringValue(state.filters.score_protocol),
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
		elevationMinMasl: elevationRange?.min,
		elevationMaxMasl: elevationRange?.max,
		includeUnknownElevation: elevationRange
			? readIncludeUnknown(state.filters.elevation_masl)
			: undefined,
		arrivalDate: readStringValue(state.filters.arrival_date),
		stockedDate: readStringValue(state.filters.stocked_date),
		stockedDays:
			parsePositiveInteger(state.filters.stocked_days?.toString() ?? null, 0) || undefined,
		orderBy: state.sortField ?? undefined,
		orderDirection: state.sortDirection ?? undefined,
		limit: state.pagination.limit,
		offset: (state.pagination.page - 1) * state.pagination.limit
	};
}
