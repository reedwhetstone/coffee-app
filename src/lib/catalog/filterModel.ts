import type { CatalogFilterValue } from '$lib/catalog/urlState';
import type { CatalogFilterVocabulary, CatalogGradeEntry } from '$lib/catalog/filterOptions';
import { formatProcessDisplayValue } from '$lib/catalog/processDisplay';
import { formatSourceName } from '$lib/utils/formatters';
import { DISCLOSURE_LABELS } from '$lib/styles/chartColors';

/**
 * One description of the catalog's filters and sorts, shared by the primary
 * row, the filter panel and the active-filter chips, so the three can never
 * disagree about what a filter is called, who may use it, or how to remove it.
 *
 * Parchment enforces every rule here; this module only decides what to show.
 */

/** The capabilities the catalog loader resolves for the viewer. */
export interface CatalogFilterAccess {
	canUseProcessFacets: boolean;
	canUseAdvancedFilters: boolean;
	canUsePriceRanges: boolean;
	canUsePriceScoreRanges: boolean;
	canUseAdvancedSorts: boolean;
	/** Wholesale-only scope: member and admin sessions (ADR-014). */
	canUseWholesaleOnly: boolean;
}

export type CatalogLock = { reason: string; href: string; action: string } | null;

const MEMBER_LOCK = { href: '/subscription', action: 'See membership' } as const;
const SIGN_IN_LOCK = { href: '/auth', action: 'Sign in free' } as const;

/** Why a control is locked for this viewer, or null when it is available. */
export function catalogFilterLock(
	access: CatalogFilterAccess,
	control:
		| 'price'
		| 'process'
		| 'variety'
		| 'freshness'
		| 'transparency'
		| 'grading'
		| 'elevation'
		| 'score'
		| 'wholesaleOnly'
		| 'advancedSort'
): CatalogLock {
	switch (control) {
		case 'price':
			return access.canUsePriceRanges
				? null
				: { reason: 'Sign in with a free account to filter by price.', ...SIGN_IN_LOCK };
		case 'process':
			return access.canUseProcessFacets
				? null
				: {
						reason: 'Members filter by process method, fermentation, additives and drying.',
						...MEMBER_LOCK
					};
		case 'variety':
			return access.canUseProcessFacets
				? null
				: { reason: 'Members filter by standardized variety and species.', ...MEMBER_LOCK };
		case 'freshness':
			return access.canUseAdvancedFilters
				? null
				: { reason: 'Members filter by how recently a coffee was stocked.', ...MEMBER_LOCK };
		case 'transparency':
			return access.canUseProcessFacets
				? null
				: {
						reason: 'Members filter by how much a supplier discloses about its process.',
						...MEMBER_LOCK
					};
		case 'grading':
			return access.canUseAdvancedFilters
				? null
				: {
						reason:
							'Members filter by grade, screen size, moisture, growing elevation and cup score.',
						...MEMBER_LOCK
					};
		case 'elevation':
			return access.canUseAdvancedFilters
				? null
				: { reason: 'Members filter by growing elevation.', ...MEMBER_LOCK };
		case 'score':
			return access.canUsePriceScoreRanges
				? null
				: { reason: 'Members filter by cup score.', ...MEMBER_LOCK };
		case 'wholesaleOnly':
			return access.canUseWholesaleOnly
				? null
				: { reason: 'Members can list wholesale suppliers only.', ...MEMBER_LOCK };
		case 'advancedSort':
			return access.canUseAdvancedSorts
				? null
				: { reason: 'Members sort by Purveyor Score.', ...MEMBER_LOCK };
	}
}

// ── Sort ─────────────────────────────────────────────────────────────────────

export interface CatalogSortOption {
	id: string;
	label: string;
	field: string | null;
	direction: 'asc' | 'desc' | null;
	locked?: boolean;
}

const SORT_OPTIONS: ReadonlyArray<CatalogSortOption & { advanced?: boolean }> = [
	{ id: 'recent', label: 'Recently stocked', field: null, direction: null },
	{ id: 'price_asc', label: 'Price, low to high', field: 'price_per_lb', direction: 'asc' },
	{ id: 'price_desc', label: 'Price, high to low', field: 'price_per_lb', direction: 'desc' },
	{
		id: 'purveyor_score',
		label: 'Purveyor Score (listing completeness)',
		field: 'purveyor_score',
		direction: 'desc',
		advanced: true
	},
	{ id: 'name', label: 'Name, A to Z', field: 'name', direction: 'asc' }
];

const LEGACY_SORT_LABELS: Record<string, string> = {
	arrival_date: 'Arrival date',
	stocked_date: 'Date stocked',
	source: 'Supplier',
	continent: 'Continent',
	country: 'Country',
	region: 'Region',
	processing: 'Process',
	cultivar_detail: 'Variety',
	score_value: 'Cup score',
	cost_lb: 'Price',
	price_per_lb: 'Price',
	purveyor_score: 'Purveyor Score',
	name: 'Name'
};

/** Cup scores are only ranked against each other within one stated protocol (ADR-016). */
const CUP_SCORE_SORT: CatalogSortOption & { advanced: true } = {
	id: 'cup_score',
	label: 'Cup score, high to low',
	field: 'score_value',
	direction: 'desc',
	advanced: true
};

function matchesSort(
	option: CatalogSortOption,
	field: string | null,
	direction: 'asc' | 'desc' | null
): boolean {
	if (option.field === null) {
		// The catalog's default order is most recently stocked first.
		return !field || (field === 'stocked_date' && direction !== 'asc');
	}
	const sameField =
		option.field === 'price_per_lb'
			? field === 'price_per_lb' || field === 'cost_lb'
			: field === option.field;
	return sameField && (direction ?? 'desc') === option.direction;
}

/**
 * The sort list for this viewer, and which entry is active. A sort from an
 * older link that is no longer offered stays selectable as its own entry, so
 * opening that link does not silently change the order.
 *
 * Cup score is offered only while one stated protocol is selected: scores on
 * different or unstated scales do not order meaningfully.
 */
export function catalogSortOptions(
	access: Pick<CatalogFilterAccess, 'canUseAdvancedSorts'>,
	current: { field: string | null; direction: 'asc' | 'desc' | null },
	scoreProtocol: string | null = null
): { options: CatalogSortOption[]; activeId: string } {
	const offered = [...SORT_OPTIONS];
	if (isStatedScoreProtocol(scoreProtocol)) {
		offered.splice(offered.length - 1, 0, CUP_SCORE_SORT);
	}
	const options: CatalogSortOption[] = offered.map(({ advanced, ...option }) => ({
		...option,
		...(advanced && !access.canUseAdvancedSorts ? { locked: true } : {})
	}));
	const active = options.find((option) => matchesSort(option, current.field, current.direction));
	if (active) return { options, activeId: active.id };

	const field = current.field as string;
	const direction = current.direction ?? 'desc';
	const activeId = `custom:${field}:${direction}`;
	const name = LEGACY_SORT_LABELS[field] ?? formatProcessDisplayValue(field);
	options.push({
		id: activeId,
		label: `${name}, ${direction === 'asc' ? 'ascending' : 'descending'}`,
		field,
		direction
	});
	return { options, activeId };
}

// ── Cup score protocols ──────────────────────────────────────────────────────

const SCORE_PROTOCOL_LABELS: Record<string, string> = {
	sca_2004: 'SCA cupping form (2004)',
	cva_affective: 'SCA Coffee Value Assessment',
	q_arabica: 'Q Arabica',
	coe: 'Cup of Excellence',
	supplier_unspecified: 'Protocol not stated'
};

export function scoreProtocolLabel(protocol: string): string {
	return SCORE_PROTOCOL_LABELS[protocol] ?? formatProcessDisplayValue(protocol);
}

/** True for a protocol whose scores share one scale, so they can be ranked. */
export function isStatedScoreProtocol(protocol: string | null | undefined): boolean {
	return (
		Boolean(protocol) && protocol !== 'supplier_unspecified' && protocol! in SCORE_PROTOCOL_LABELS
	);
}

type CatalogSort = { sortField: string | null; sortDirection: 'asc' | 'desc' | null };

/**
 * The sort to keep after the filters change. A cup score order belongs to the
 * stated protocol it was chosen under, so it ends when a change leaves that
 * protocol, whichever control made the change and also when the protocol
 * filter was not applied. A cup score order from an older link, which never
 * had a protocol, is left as it arrived.
 */
export function catalogSortAfterFilterChange(
	sort: CatalogSort,
	before: Record<string, CatalogFilterValue>,
	after: Record<string, CatalogFilterValue>
): CatalogSort {
	const protocol = after.score_protocol;
	const leavesProtocol =
		sort.sortField === CUP_SCORE_SORT.field &&
		before.score_protocol !== protocol &&
		!isStatedScoreProtocol(typeof protocol === 'string' ? protocol : null);
	return leavesProtocol
		? { sortField: null, sortDirection: null }
		: { sortField: sort.sortField, sortDirection: sort.sortDirection };
}

// ── Grades ───────────────────────────────────────────────────────────────────

/** The kinds of grade, in the order the panel lists them. */
export const GRADE_KINDS = [
	{ dimension: 'size', label: 'Size', facet: 'grade_size' },
	{ dimension: 'altitude', label: 'Altitude', facet: 'grade_altitude' },
	{ dimension: 'defects', label: 'Defects', facet: 'grade_defects' },
	{ dimension: 'cup', label: 'Cup', facet: 'grade_cup' },
	{ dimension: 'preparation', label: 'Preparation', facet: 'grade_preparation' }
] as const;

export function gradeLabel(
	grades: readonly CatalogGradeEntry[] | null | undefined,
	code: string
): string {
	return grades?.find((grade) => grade.code === code)?.label ?? code;
}

// ── Price presets ────────────────────────────────────────────────────────────

export const PRICE_PRESETS = [
	{ id: 'under_8', label: 'Under $8', min: '', max: '8' },
	{ id: '8_to_12', label: '$8 to $12', min: '8', max: '12' },
	{ id: 'over_12', label: '$12 and up', min: '12', max: '' }
] as const;

type RangeValue = { min: string | number; max: string | number; includeUnknown?: boolean };

export function readRange(value: CatalogFilterValue | undefined): RangeValue {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as RangeValue)
		: { min: '', max: '' };
}

export function activePricePresetId(value: CatalogFilterValue | undefined): string | null {
	const range = readRange(value);
	const preset = PRICE_PRESETS.find(
		(candidate) => String(range.min) === candidate.min && String(range.max) === candidate.max
	);
	return preset?.id ?? null;
}

// ── Stocked window ───────────────────────────────────────────────────────────

export const STOCKED_WINDOWS = [
	{ days: 7, label: 'Last 7 days' },
	{ days: 30, label: 'Last 30 days' },
	{ days: 90, label: 'Last 90 days' }
] as const;

// ── Active filters ───────────────────────────────────────────────────────────

/** A removable chip: what the viewer sees, and what removing it changes. */
export interface ActiveCatalogFilter {
	id: string;
	label: string;
	remove:
		| { kind: 'filter'; key: string; value: CatalogFilterValue }
		| { kind: 'supplierScope' }
		| { kind: 'includeUnstocked' };
	/** True when the control lives in the panel, not the primary row. */
	inPanel: boolean;
}

export interface CatalogFilterSnapshot {
	filters: Record<string, CatalogFilterValue>;
	showWholesale: boolean;
	wholesaleOnly: boolean;
	includeUnstocked: boolean;
}

function vocabularyLabel(
	entries: CatalogFilterVocabulary[keyof CatalogFilterVocabulary] | undefined,
	code: string
): string {
	return entries?.find((entry) => entry.code === code)?.label ?? formatProcessDisplayValue(code);
}

function rangeText(
	range: RangeValue,
	format: (value: string) => string,
	open: { below: string; above: string }
): string {
	const min = String(range.min ?? '').trim();
	const max = String(range.max ?? '').trim();
	if (min && max) return `${format(min)} to ${format(max)}`;
	if (min) return `${format(min)} ${open.above}`;
	return `${open.below} ${format(max)}`;
}

const TEXT_FILTERS: ReadonlyArray<
	readonly [key: string, label: string, inPanel: boolean, format?: (value: string) => string]
> = [
	['name', 'Name', false],
	['origin', 'Origin', true],
	['continent', 'Continent', true],
	['region', 'Region', true],
	['processing', 'Process', false],
	['processing_base_method', 'Process', false, formatProcessDisplayValue],
	['fermentation_type', 'Fermentation', true, formatProcessDisplayValue],
	['process_additive', 'Additive', true, formatProcessDisplayValue],
	[
		'processing_disclosure_level',
		'Process disclosure',
		true,
		(level) => DISCLOSURE_LABELS[level] ?? formatProcessDisplayValue(level)
	],
	['cultivar_detail', 'Variety name', true],
	['type', 'Importer type', true],
	['grade', 'Grade text', true],
	['appearance', 'Appearance', true],
	['arrival_date', 'Arrival', true],
	['stocked_date', 'Stocked since', true]
];

const LIST_FILTERS: ReadonlyArray<
	readonly [
		key: string,
		label: string,
		inPanel: boolean,
		vocabulary?: keyof CatalogFilterVocabulary
	]
> = [
	['country', 'Origin', false],
	['source', 'Supplier', true],
	['drying_method_code', 'Drying', true, 'drying_methods'],
	['variety_code', 'Variety', true, 'varieties'],
	['species_code', 'Species', true, 'species']
];

const CONFIDENCE_LABELS: Record<string, string> = {
	'0.6': 'moderate',
	'0.8': 'high',
	'0.9': 'very high'
};

/**
 * Every active filter as a removable chip, in a stable reading order. Filters
 * that arrived from an older link and no longer have a control are listed too,
 * because they still narrow the results.
 */
export function describeActiveCatalogFilters(
	snapshot: CatalogFilterSnapshot,
	vocabulary: CatalogFilterVocabulary | null = null,
	grades: readonly CatalogGradeEntry[] | null = null
): ActiveCatalogFilter[] {
	const { filters } = snapshot;
	const chips: ActiveCatalogFilter[] = [];
	const clear = (key: string): ActiveCatalogFilter['remove'] => ({
		kind: 'filter',
		key,
		value: ''
	});

	for (const [key, label, inPanel, format] of TEXT_FILTERS) {
		const value = filters[key];
		if (typeof value !== 'string' || value.trim() === '') continue;
		chips.push({
			id: key,
			label: `${label}: ${format ? format(value) : value}`,
			remove: clear(key),
			inPanel
		});
	}

	for (const [key, label, inPanel, vocabularyKey] of LIST_FILTERS) {
		const values = filters[key];
		if (!Array.isArray(values)) continue;
		// One chip per value, so chip ids stay unique.
		for (const value of new Set(values)) {
			const text = vocabularyKey
				? vocabularyLabel(vocabulary?.[vocabularyKey], value)
				: key === 'source'
					? formatSourceName(value)
					: value;
			chips.push({
				id: `${key}:${value}`,
				label: `${label}: ${text}`,
				remove: { kind: 'filter', key, value: values.filter((entry) => entry !== value) },
				inPanel
			});
		}
	}

	if (Array.isArray(filters.grade_code)) {
		const codes = filters.grade_code.map(String);
		for (const code of codes) {
			chips.push({
				id: `grade_code:${code}`,
				label: `Grade: ${gradeLabel(grades, code)}`,
				remove: {
					kind: 'filter',
					key: 'grade_code',
					value: codes.filter((entry) => entry !== code)
				},
				inPanel: true
			});
		}
	}
	if (filters.peaberry === true) {
		chips.push({ id: 'peaberry', label: 'Peaberry', remove: clear('peaberry'), inPanel: true });
	}
	if (filters.lab_analyzed === true) {
		chips.push({
			id: 'lab_analyzed',
			label: 'Lab analyzed',
			remove: clear('lab_analyzed'),
			inPanel: true
		});
	}
	const screen = readRange(filters.screen_size);
	if (String(screen.min) !== '' || String(screen.max) !== '') {
		const text = rangeText(screen, (value) => value, { below: 'up to', above: 'and up' });
		chips.push({
			id: 'screen_size',
			label: `Screen size: ${text}${screen.includeUnknown ? ', or not stated' : ''}`,
			remove: clear('screen_size'),
			inPanel: true
		});
	}
	const moistureMax = Number(filters.moisture_max);
	if (filters.moisture_max !== undefined && Number.isFinite(moistureMax) && moistureMax > 0) {
		chips.push({
			id: 'moisture_max',
			label: `Moisture: up to ${moistureMax}%`,
			remove: clear('moisture_max'),
			inPanel: true
		});
	}

	if (typeof filters.has_additives === 'boolean') {
		chips.push({
			id: 'has_additives',
			label: filters.has_additives ? 'Has additives' : 'No additives',
			remove: clear('has_additives'),
			inPanel: true
		});
	}

	const confidence = filters.processing_confidence_min;
	if (confidence !== undefined && confidence !== null && confidence !== '') {
		const level = CONFIDENCE_LABELS[String(confidence)] ?? String(confidence);
		chips.push({
			id: 'processing_confidence_min',
			label: `Process confidence: at least ${level}`,
			remove: clear('processing_confidence_min'),
			inPanel: true
		});
	}

	const price = readRange(filters.cost_lb);
	if (String(price.min) !== '' || String(price.max) !== '') {
		chips.push({
			id: 'cost_lb',
			label: `Price: ${rangeText(price, (value) => `$${value}`, { below: 'up to', above: 'and up' })} per lb`,
			remove: clear('cost_lb'),
			inPanel: false
		});
	}

	const elevation = readRange(filters.elevation_masl);
	if (String(elevation.min) !== '' || String(elevation.max) !== '') {
		const text = rangeText(elevation, (value) => `${Number(value).toLocaleString('en-US')} m`, {
			below: 'up to',
			above: 'and up'
		});
		chips.push({
			id: 'elevation_masl',
			label: `Elevation: ${text}${elevation.includeUnknown ? ', or not stated' : ''}`,
			remove: clear('elevation_masl'),
			inPanel: true
		});
	}

	const score = readRange(filters.score_value);
	if (String(score.min) !== '' || String(score.max) !== '') {
		chips.push({
			id: 'score_value',
			label: `Cup score: ${rangeText(score, (value) => value, { below: 'up to', above: 'and up' })}`,
			remove: clear('score_value'),
			inPanel: true
		});
	}

	if (typeof filters.score_protocol === 'string' && filters.score_protocol !== '') {
		chips.push({
			id: 'score_protocol',
			label: `Cup score protocol: ${scoreProtocolLabel(filters.score_protocol)}`,
			remove: clear('score_protocol'),
			inPanel: true
		});
	}

	const stockedDays = Number(filters.stocked_days);
	if (Number.isFinite(stockedDays) && stockedDays > 0) {
		chips.push({
			id: 'stocked_days',
			label: `Stocked in the last ${stockedDays} days`,
			remove: clear('stocked_days'),
			inPanel: true
		});
	}

	if (snapshot.wholesaleOnly) {
		chips.push({
			id: 'supplier_scope',
			label: 'Wholesale suppliers only',
			remove: { kind: 'supplierScope' },
			inPanel: true
		});
	} else if (!snapshot.showWholesale) {
		chips.push({
			id: 'supplier_scope',
			label: 'Hobbyist suppliers only',
			remove: { kind: 'supplierScope' },
			inPanel: true
		});
	}

	if (snapshot.includeUnstocked) {
		chips.push({
			id: 'include_unstocked',
			label: 'Including out of stock',
			remove: { kind: 'includeUnstocked' },
			inPanel: false
		});
	}

	return chips;
}
