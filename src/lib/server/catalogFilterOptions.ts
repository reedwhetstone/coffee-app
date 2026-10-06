import type { CatalogListQuery, ParchmentClient, components } from '@purveyors/sdk';
import { toParchmentCatalogQuery, type CatalogQueryValue } from '$lib/catalog/parchmentQuery';
import type {
	CatalogFacetCount,
	CatalogFilterOptions,
	CatalogFilterVocabulary,
	CatalogGradeEntry,
	CatalogVocabularyEntry
} from '$lib/catalog/filterOptions';

/**
 * Options and counts for the catalog filter controls.
 *
 * Parchment owns filtering, entitlement and counting. This module only decides
 * which Parchment reads the controls need and stitches their answers together:
 *
 * - one facets read under the active filters;
 * - for each control with an active selection, one more read with that
 *   control's own filter removed, so its other options show how many coffees
 *   they would match instead of all reading zero;
 * - for callers who may filter by variety, the variety, species and drying
 *   vocabulary, and how many coffees carry no standardized variety;
 * - for callers who may filter by grade, the grade vocabulary, the grading
 *   counts, and how many coffees carry a cup score under each protocol.
 *
 * The response carries only what the controls read. Parchment's full facet set
 * is a few hundred kilobytes, most of it open text nobody picks from a list.
 */

type CatalogFacetsQuery = NonNullable<Parameters<ParchmentClient['catalog']['facets']>[0]>;
type CatalogFacetsResponse = components['schemas']['CatalogFacetsResponse'];
type CatalogTaxonomies = components['schemas']['CatalogTaxonomiesResponse']['data'];

/** Request params that describe the page, not which coffees match. */
const NON_FILTER_QUERY_KEYS = new Set([
	'counts',
	'page',
	'limit',
	'sortField',
	'sortDirection',
	'projection',
	'view',
	'map_lens',
	'map_units',
	'map_center',
	'map_zoom',
	'map_bbox',
	'map_place',
	'coffee',
	'tracked'
]);

type OptInCounts = 'taxonomy' | 'grading';

/**
 * Controls that show counted options: the Parchment filter params each one
 * sets, the facets that list its options, and the opt-in count set those
 * facets belong to, if any. A control with an active selection gets one more
 * read with its own params removed.
 */
const SELECTION_FACETS: ReadonlyArray<{
	params: readonly string[];
	facets: readonly string[];
	include?: OptInCounts;
}> = [
	{ params: ['country'], facets: ['countries'] },
	{ params: ['continent'], facets: ['continents'] },
	{ params: ['source'], facets: ['sources'] },
	{ params: ['processing'], facets: ['processing'] },
	{ params: ['processing_base_method'], facets: ['processing_base_method'] },
	{ params: ['fermentation_type'], facets: ['fermentation_type'] },
	{ params: ['process_additive'], facets: ['process_additives'] },
	{ params: ['arrivalDate'], facets: ['arrivalDates'] },
	{ params: ['processing_disclosure_level'], facets: ['processing_disclosure_level'] },
	{ params: ['varietyCode'], facets: ['varieties'], include: 'taxonomy' },
	{ params: ['speciesCode'], facets: ['species_codes'], include: 'taxonomy' },
	{ params: ['dryingMethodCode'], facets: ['drying_methods'], include: 'taxonomy' },
	// One grade selection spans every kind of grade (ADR-016).
	{
		params: ['gradeCode'],
		facets: ['grade_size', 'grade_altitude', 'grade_defects', 'grade_cup', 'grade_preparation'],
		include: 'grading'
	},
	{
		params: ['screenMin', 'screenMax', 'includeUnknownScreen'],
		facets: ['screen_size_min'],
		include: 'grading'
	},
	{
		params: ['elevationMinMasl', 'elevationMaxMasl', 'includeUnknownElevation'],
		facets: ['elevation_band'],
		include: 'grading'
	}
];

/** Params that narrow by cup score; the protocol counts are read without them. */
const SCORE_PARAMS = ['scoreValueMin', 'scoreValueMax', 'scoreProtocol'] as const;
const UNSTATED_PROTOCOL = 'supplier_unspecified';
const STATED_PROTOCOLS = ['sca_2004', 'cva_affective', 'q_arabica', 'coe'] as const;

/** Region is typed, not picked: the control only suggests the most common. */
const REGION_SUGGESTION_LIMIT = 150;

type FilterQuery = Record<string, CatalogQueryValue>;

/** The request's catalog filters, in Parchment's parameter names. */
export function toCatalogFilterQuery(url: URL): FilterQuery {
	const appQuery: FilterQuery = {};
	for (const key of new Set(url.searchParams.keys())) {
		if (NON_FILTER_QUERY_KEYS.has(key)) continue;
		const values = url.searchParams.getAll(key).filter((value) => value !== '');
		if (values.length === 0) continue;
		appQuery[key] = values.length > 1 ? values : values[0];
	}

	const query = toParchmentCatalogQuery(appQuery);
	if (query.stocked !== 'all' && query.stocked !== 'false') query.stocked = 'true';
	query.showWholesale = query.showWholesale === 'false' ? 'false' : 'true';
	if (query.wholesaleOnly === 'true') query.showWholesale = 'true';
	else delete query.wholesaleOnly;
	return query;
}

async function readFacets(
	client: ParchmentClient,
	query: FilterQuery
): Promise<CatalogFacetsResponse> {
	const { data, error } = await client.catalog.facets(query as CatalogFacetsQuery);
	if (error || !data) throw new Error('Catalog facets request failed');
	return data;
}

async function readTotal(client: ParchmentClient, query: FilterQuery): Promise<number> {
	const { data, error } = await client.catalog.list({
		...query,
		page: 1,
		limit: 1,
		projection: 'summary'
	} as CatalogListQuery);
	const total = (data as { pagination?: { total?: unknown } } | undefined)?.pagination?.total;
	if (error || typeof total !== 'number') throw new Error('Catalog total request failed');
	return total;
}

function withoutParams(query: FilterQuery, params: readonly string[]): FilterQuery {
	return Object.fromEntries(Object.entries(query).filter(([key]) => !params.includes(key)));
}

function withCounts(query: FilterQuery, include: readonly OptInCounts[]): FilterQuery {
	return include.length > 0 ? { ...query, include: include.join(',') } : query;
}

function toVocabulary(taxonomies: CatalogTaxonomies): CatalogFilterVocabulary {
	const entries = (list: ReadonlyArray<CatalogVocabularyEntry>): CatalogVocabularyEntry[] =>
		list.map(({ code, label, parent_code }) => ({ code, label, parent_code }));
	return {
		varieties: entries(taxonomies.varieties),
		species: entries(taxonomies.species),
		drying_methods: entries(taxonomies.drying_methods)
	};
}

/**
 * The listing counts each coffee once and a family code matches every code
 * under it, so "all coffees" minus "coffees carrying any top-level variety" is
 * the number with no standardized variety. Facet counts cannot give this:
 * a blend is counted under each of its families.
 */
async function countUnstandardizedVarieties(
	client: ParchmentClient,
	query: FilterQuery,
	vocabulary: CatalogFilterVocabulary
): Promise<number | null> {
	const families = vocabulary.varieties
		.filter((entry) => entry.parent_code === null)
		.map((entry) => entry.code);
	if (families.length === 0) return null;
	const others = withoutParams(query, ['varietyCode']);
	try {
		const [all, standardized] = await Promise.all([
			readTotal(client, others),
			readTotal(client, { ...others, varietyCode: families })
		]);
		return Math.max(0, all - standardized);
	} catch {
		return null;
	}
}

/**
 * How many coffees carry a cup score under each protocol, with the score
 * filters themselves removed. Almost every score has no protocol stated, so
 * this first asks whether any does (two totals) and only then counts the
 * stated protocols one by one.
 */
async function countScoreProtocols(
	client: ParchmentClient,
	query: FilterQuery
): Promise<CatalogFacetCount[] | undefined> {
	const others = withoutParams(query, SCORE_PARAMS);
	try {
		const [scored, unstated] = await Promise.all([
			readTotal(client, { ...others, scoreValueMin: 0 }),
			readTotal(client, { ...others, scoreProtocol: UNSTATED_PROTOCOL })
		]);
		const counts: CatalogFacetCount[] =
			unstated > 0 ? [{ value: UNSTATED_PROTOCOL, count: unstated }] : [];
		if (scored > unstated) {
			const stated = await Promise.all(
				STATED_PROTOCOLS.map(async (protocol) => ({
					value: protocol as string,
					count: await readTotal(client, { ...others, scoreProtocol: protocol })
				}))
			);
			counts.unshift(...stated.filter((entry) => entry.count > 0));
		}
		return counts;
	} catch {
		// Left out, which the controls read as "counts unknown". An empty list
		// would claim that no coffee states a protocol.
		return undefined;
	}
}

/**
 * The facets the controls read. When nothing matches the filters Parchment
 * leaves a facet out, which the controls must read as "no options", not as
 * "counts unknown", so a facet with no values is returned as an empty list.
 */
function pickOptionFacets(
	response: CatalogFacetsResponse,
	included: readonly OptInCounts[]
): Pick<CatalogFilterOptions, 'values' | 'facets'> {
	const allValues = response.values as Record<string, string[] | undefined>;
	const allFacets = response.facets as Record<string, CatalogFacetCount[] | undefined>;
	const values: Record<string, string[]> = {};
	const facets: Record<string, CatalogFacetCount[]> = {};
	for (const control of SELECTION_FACETS) {
		if (control.include && !included.includes(control.include)) continue;
		for (const facet of control.facets) {
			const listed = allValues[facet] ?? [];
			const counted = allFacets[facet] ?? (listed.length === 0 ? [] : undefined);
			values[facet] = listed;
			if (counted) facets[facet] = counted;
		}
	}
	facets.regions = [...(allFacets.regions ?? [])]
		.sort((a, b) => b.count - a.count)
		.slice(0, REGION_SUGGESTION_LIMIT);
	return { values, facets };
}

export interface CatalogFilterOptionsAccess {
	/** Structured process filters and the variety, species and drying vocabulary. */
	canUseProcessFacets: boolean;
	/** Grading filters: grade designations, screen size, elevation bands. */
	canUseAdvancedFilters: boolean;
	/** Cup score range and protocol. */
	canUsePriceScoreRanges: boolean;
}

export async function loadCatalogFilterOptions(
	client: ParchmentClient,
	url: URL,
	access: CatalogFilterOptionsAccess
): Promise<CatalogFilterOptions> {
	const filterQuery = toCatalogFilterQuery(url);
	const included: OptInCounts[] = [
		...(access.canUseProcessFacets ? (['taxonomy'] as const) : []),
		...(access.canUseAdvancedFilters ? (['grading'] as const) : [])
	];
	const query = withCounts(filterQuery, included);

	// The vocabularies and the counts built from listing totals do not wait for
	// the facets, which are the slowest read here.
	const vocabularyRead: Promise<CatalogFilterVocabulary | undefined> = access.canUseProcessFacets
		? client.catalog
				.taxonomies()
				.then(({ data }) => (data ? toVocabulary(data.data) : undefined))
				.catch(() => undefined)
		: Promise.resolve(undefined);
	const unstandardizedRead = vocabularyRead.then((vocabulary) =>
		vocabulary ? countUnstandardizedVarieties(client, filterQuery, vocabulary) : null
	);
	const gradesRead: Promise<CatalogGradeEntry[] | undefined> = access.canUseAdvancedFilters
		? client.catalog
				.grades()
				.then(({ data }) =>
					data?.data
						.filter((grade) => grade.active)
						.map(({ code, label, description, dimensions, sort_order }) => ({
							code,
							label,
							description,
							dimensions: [...dimensions],
							sort_order
						}))
				)
				.catch(() => undefined)
		: Promise.resolve(undefined);
	const scoreProtocolRead =
		access.canUseAdvancedFilters && access.canUsePriceScoreRanges
			? countScoreProtocols(client, filterQuery)
			: Promise.resolve(undefined);

	const activeSelections = SELECTION_FACETS.filter(
		(control) =>
			(!control.include || included.includes(control.include)) &&
			control.params.some((param) => param in filterQuery)
	);
	const [base, alternatives, vocabulary, unstandardizedVarietyCount, grades, scoreProtocols] =
		await Promise.all([
			readFacets(client, query),
			Promise.all(
				activeSelections.map(async (control) => {
					const needed = control.include ? [control.include] : [];
					try {
						const response = await readFacets(
							client,
							withCounts(withoutParams(filterQuery, control.params), needed)
						);
						return { control, picked: pickOptionFacets(response, needed) };
					} catch {
						// Keep the base counts for this control when its extra read fails.
						return null;
					}
				})
			),
			vocabularyRead,
			unstandardizedRead,
			gradesRead,
			scoreProtocolRead
		]);

	const { values, facets } = pickOptionFacets(base, included);
	for (const alternative of alternatives) {
		if (!alternative) continue;
		for (const facet of alternative.control.facets) {
			values[facet] = alternative.picked.values[facet] ?? [];
			if (alternative.picked.facets[facet]) facets[facet] = alternative.picked.facets[facet];
			else delete facets[facet];
		}
	}
	if (scoreProtocols) facets.score_protocols = scoreProtocols;

	return {
		values,
		facets,
		...(vocabulary ? { vocabulary, unstandardizedVarietyCount } : {}),
		...(grades ? { grades } : {})
	};
}
