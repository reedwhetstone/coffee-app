import type { CatalogFilterValue } from '$lib/catalog/urlState';
import type { CatalogFilterVocabulary } from '$lib/catalog/filterOptions';
import { formatProcessDisplayValue } from '$lib/catalog/processDisplay';
import { formatSourceName } from '$lib/utils/formatters';

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

function sortOptionId(field: string | null, direction: 'asc' | 'desc' | null): string {
	if (!field) return 'recent';
	// The catalog's default order is most recently stocked first.
	if (field === 'stocked_date' && direction !== 'asc') return 'recent';
	const price = field === 'price_per_lb' || field === 'cost_lb';
	if (price) return direction === 'desc' ? 'price_desc' : 'price_asc';
	if (field === 'purveyor_score' && direction !== 'asc') return 'purveyor_score';
	if (field === 'name' && direction !== 'desc') return 'name';
	return `custom:${field}:${direction ?? 'desc'}`;
}

/**
 * The sort list for this viewer, and which entry is active. A sort from an
 * older link that is no longer offered stays selectable as its own entry, so
 * opening that link does not silently change the order.
 */
export function catalogSortOptions(
	access: Pick<CatalogFilterAccess, 'canUseAdvancedSorts'>,
	current: { field: string | null; direction: 'asc' | 'desc' | null }
): { options: CatalogSortOption[]; activeId: string } {
	const activeId = sortOptionId(current.field, current.direction);
	const options: CatalogSortOption[] = SORT_OPTIONS.map(({ advanced, ...option }) => ({
		...option,
		...(advanced && !access.canUseAdvancedSorts ? { locked: true } : {})
	}));
	if (activeId.startsWith('custom:') && current.field) {
		const name = LEGACY_SORT_LABELS[current.field] ?? formatProcessDisplayValue(current.field);
		options.push({
			id: activeId,
			label: `${name}, ${current.direction === 'asc' ? 'ascending' : 'descending'}`,
			field: current.field,
			direction: current.direction ?? 'desc'
		});
	}
	return { options, activeId };
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
	['processing_disclosure_level', 'Process disclosure', true, formatProcessDisplayValue],
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
	vocabulary: CatalogFilterVocabulary | null = null
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
		for (const value of values) {
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
