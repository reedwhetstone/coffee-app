import type { CatalogListQuery, ParchmentClient, components } from '@purveyors/sdk';
import { toParchmentCatalogQuery, type CatalogQueryValue } from '$lib/catalog/parchmentQuery';
import type {
	CatalogFacetCount,
	CatalogFilterOptions,
	CatalogFilterVocabulary,
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
 *   vocabulary, and how many coffees carry no standardized variety.
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

/**
 * Controls that offer a list of options: the Parchment filter param each one
 * sets, and the facet that lists its options.
 */
const SELECTION_FACETS: ReadonlyArray<readonly [param: string, facet: string]> = [
	['country', 'countries'],
	['continent', 'continents'],
	['source', 'sources'],
	['processing', 'processing'],
	['processing_base_method', 'processing_base_method'],
	['fermentation_type', 'fermentation_type'],
	['process_additive', 'process_additives'],
	['arrivalDate', 'arrivalDates'],
	['varietyCode', 'varieties'],
	['speciesCode', 'species_codes'],
	['dryingMethodCode', 'drying_methods']
];

/** Facets whose counts need `include=taxonomy`. */
const TAXONOMY_FACETS = new Set(['varieties', 'species_codes', 'drying_methods']);

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

function withoutParam(query: FilterQuery, param: string): FilterQuery {
	const { [param]: _removed, ...rest } = query;
	return rest;
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
	const others = withoutParam(query, 'varietyCode');
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
 * The facets the controls read. When nothing matches the filters Parchment
 * leaves a facet out, which the controls must read as "no options", not as
 * "counts unknown", so a facet with no values is returned as an empty list.
 */
function pickOptionFacets(
	response: CatalogFacetsResponse,
	includesTaxonomy: boolean
): Pick<CatalogFilterOptions, 'values' | 'facets'> {
	const allValues = response.values as Record<string, string[] | undefined>;
	const allFacets = response.facets as Record<string, CatalogFacetCount[] | undefined>;
	const values: Record<string, string[]> = {};
	const facets: Record<string, CatalogFacetCount[]> = {};
	for (const [, facet] of SELECTION_FACETS) {
		if (TAXONOMY_FACETS.has(facet) && !includesTaxonomy) continue;
		const listed = allValues[facet] ?? [];
		const counted = allFacets[facet] ?? (listed.length === 0 ? [] : undefined);
		values[facet] = listed;
		if (counted) facets[facet] = counted;
	}
	facets.regions = [...(allFacets.regions ?? [])]
		.sort((a, b) => b.count - a.count)
		.slice(0, REGION_SUGGESTION_LIMIT);
	return { values, facets };
}

export async function loadCatalogFilterOptions(
	client: ParchmentClient,
	url: URL,
	access: { canUseProcessFacets: boolean }
): Promise<CatalogFilterOptions> {
	const filterQuery = toCatalogFilterQuery(url);
	const query: FilterQuery = access.canUseProcessFacets
		? { ...filterQuery, include: 'taxonomy' }
		: filterQuery;

	// The vocabulary and the no-standardized-variety count do not wait for the
	// facets, which are the slowest read here.
	const vocabularyRead: Promise<CatalogFilterVocabulary | undefined> = access.canUseProcessFacets
		? client.catalog
				.taxonomies()
				.then(({ data }) => (data ? toVocabulary(data.data) : undefined))
				.catch(() => undefined)
		: Promise.resolve(undefined);
	const unstandardizedRead = vocabularyRead.then((vocabulary) =>
		vocabulary ? countUnstandardizedVarieties(client, filterQuery, vocabulary) : null
	);

	const activeSelections = SELECTION_FACETS.filter(([param]) => param in query);
	const [base, alternatives, vocabulary, unstandardizedVarietyCount] = await Promise.all([
		readFacets(client, query),
		Promise.all(
			activeSelections.map(async ([param, facet]) => {
				try {
					const response = await readFacets(
						client,
						withoutParam(TAXONOMY_FACETS.has(facet) ? query : filterQuery, param)
					);
					return [facet, response] as const;
				} catch {
					// Keep the base counts for this control when its extra read fails.
					return null;
				}
			})
		),
		vocabularyRead,
		unstandardizedRead
	]);

	const { values, facets } = pickOptionFacets(base, access.canUseProcessFacets);
	for (const alternative of alternatives) {
		if (!alternative) continue;
		const [facet, response] = alternative;
		const picked = pickOptionFacets(response, TAXONOMY_FACETS.has(facet));
		values[facet] = picked.values[facet] ?? [];
		if (picked.facets[facet]) facets[facet] = picked.facets[facet];
		else delete facets[facet];
	}

	if (!vocabulary) return { values, facets };
	return { values, facets, vocabulary, unstandardizedVarietyCount };
}
