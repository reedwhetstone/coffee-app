import type { PageServerLoad } from './$types';
import type { CatalogListQuery, ParchmentClient, components } from '@purveyors/sdk';
import { toCatalogResourceItem } from '$lib/catalog/catalogResourceItem';
import { CatalogSchemaUnavailableError } from '$lib/data/catalog';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import {
	PROCESS_FACET_FILTER_KEYS,
	createProcessFacetDeniedNotice,
	getRequestedProcessFacetParams,
	resolveCatalogAccessCapabilities,
	type CatalogAccessDeniedNotice
} from '$lib/server/catalogAccess';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';
import {
	catalogUrlStateToSearchState,
	parseCatalogUrlState,
	type CatalogUrlState
} from '$lib/catalog/urlState';
import {
	createParchmentServerClient,
	resolveCatalogCredentialMode
} from '$lib/server/parchmentClient';
import { getTrackedLotIds } from '$lib/server/trackedLots';
import { getBriefMatchSummaries, type BriefMatchSummary } from '$lib/server/briefMatchSummary';

// Watchlist-only view is served as a single page; tracked lists are small.
const TRACKED_VIEW_LIMIT = 200;
type SdkCatalogItem = components['schemas']['CatalogItem'];
// Per-origin price context comes from Parchment's canonical endpoint; its object
// shape is identical to the page component's OriginPriceStats.
type CatalogOriginPriceStats =
	components['schemas']['CatalogOriginPriceStatsResponse']['originPriceStats'];
type CatalogOriginPriceStatsQuery = NonNullable<
	Parameters<ParchmentClient['catalog']['originPriceStats']>[0]
>;
// The installed SDK's CatalogListQuery type lags the Span A generated params.
// Keep this overlay local to the BFF adapter until the next SDK type publish.
type ParchmentCatalogListQuery = CatalogListQuery & {
	showWholesale?: 'true' | 'false';
	wholesaleOnly?: 'true' | 'false';
	origin?: string;
	continent?: string;
	country?: string | string[];
	source?: string | string[];
	processing?: string;
	processing_base_method?: string;
	fermentation_type?: string;
	process_additive?: string;
	has_additives?: 'true' | 'false';
	processing_disclosure_level?: string;
	processing_confidence_min?: number;
	cultivar_detail?: string;
	type?: string;
	grade?: string;
	appearance?: string;
	name?: string;
	region?: string;
	score_value_min?: number;
	score_value_max?: number;
	price_per_lb_min?: number;
	price_per_lb_max?: number;
	arrival_date?: string;
	stocked_date?: string;
	sortField?: string;
	sortDirection?: 'asc' | 'desc';
	ids?: number[];
};

type CatalogListBody = {
	data?: unknown;
	pagination?: {
		total?: number | null;
	};
};

type CatalogListResult = {
	data?: CatalogListBody | unknown[];
	error?: unknown;
};

function parseCatalogDeepLinkCoffeeId(value: string | null): number | null {
	if (!value || !/^\d+$/.test(value)) return null;

	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildPagination(state: CatalogUrlState, total: number) {
	const totalPages = total > 0 ? Math.ceil(total / state.pagination.limit) : 0;
	return {
		page: state.pagination.page,
		limit: state.pagination.limit,
		total,
		totalPages,
		hasNext: totalPages > 0 && state.pagination.page < totalPages,
		hasPrev: state.pagination.page > 1
	};
}

function appendStringParam(
	query: ParchmentCatalogListQuery,
	key: keyof ParchmentCatalogListQuery,
	value: string | undefined
): void {
	if (value !== undefined && value !== '') {
		(query as Record<string, unknown>)[key] = value;
	}
}

function appendStringArrayParam(
	query: ParchmentCatalogListQuery,
	key: keyof ParchmentCatalogListQuery,
	value: string[] | undefined
): void {
	if (value && value.length > 0) {
		(query as Record<string, unknown>)[key] = value;
	}
}

function appendNumberParam(
	query: ParchmentCatalogListQuery,
	key: keyof ParchmentCatalogListQuery,
	value: number | undefined
): void {
	if (value !== undefined) {
		(query as Record<string, unknown>)[key] = value;
	}
}

function buildParchmentCatalogQuery(
	state: CatalogUrlState,
	options: {
		stocked: 'true' | 'false' | 'all';
		page?: number;
		limit?: number;
		coffeeIds?: number[];
	} = { stocked: 'true' }
): ParchmentCatalogListQuery {
	const searchState = catalogUrlStateToSearchState(state);
	const query: ParchmentCatalogListQuery = {
		page: options.page ?? state.pagination.page,
		limit: options.limit ?? state.pagination.limit,
		stocked: options.stocked,
		showWholesale: state.showWholesale ? 'true' : 'false',
		wholesaleOnly: state.wholesaleOnly ? 'true' : 'false'
	};

	appendStringParam(query, 'sortField', searchState.orderBy);
	if (searchState.orderDirection) {
		query.sortDirection = searchState.orderDirection;
	}
	appendStringParam(query, 'origin', searchState.origin);
	appendStringParam(query, 'continent', searchState.continent);
	if (searchState.country !== undefined) {
		query.country = searchState.country;
	}
	appendStringArrayParam(query, 'source', searchState.source);
	appendStringParam(query, 'processing', searchState.processing);
	appendStringParam(query, 'processing_base_method', searchState.processingBaseMethod);
	appendStringParam(query, 'fermentation_type', searchState.fermentationType);
	appendStringParam(query, 'process_additive', searchState.processAdditive);
	if (searchState.hasAdditives !== undefined) {
		query.has_additives = searchState.hasAdditives ? 'true' : 'false';
	}
	appendStringParam(query, 'processing_disclosure_level', searchState.processingDisclosureLevel);
	appendNumberParam(query, 'processing_confidence_min', searchState.processingConfidenceMin);
	appendStringParam(query, 'cultivar_detail', searchState.cultivarDetail);
	appendStringParam(query, 'type', searchState.type);
	appendStringParam(query, 'grade', searchState.grade);
	appendStringParam(query, 'appearance', searchState.appearance);
	appendStringParam(query, 'name', searchState.name);
	appendStringParam(query, 'region', searchState.region);
	appendNumberParam(query, 'score_value_min', searchState.scoreValueMin);
	appendNumberParam(query, 'score_value_max', searchState.scoreValueMax);
	appendNumberParam(query, 'price_per_lb_min', searchState.pricePerLbMin);
	appendNumberParam(query, 'price_per_lb_max', searchState.pricePerLbMax);
	appendStringParam(query, 'arrival_date', searchState.arrivalDate);
	appendStringParam(query, 'stocked_date', searchState.stockedDate);

	if (options.coffeeIds && options.coffeeIds.length > 0) {
		query.ids = options.coffeeIds;
	}

	return query;
}

// openapi-fetch resolves non-2xx catalog responses as `{ error: <json body> }`
// instead of rejecting, so translate the parsed error body into a typed Error the
// caller can route. Parchment emits a structured envelope `{ error: { code, message } }`
// and maps CatalogSchemaUnavailableError to a 503 with `code: "schema_unavailable"`,
// so that body becomes a CatalogSchemaUnavailableError and the controlled fallback
// runs; everything else throws a real Error to preserve the SSR 500 path.
function normalizeCatalogListError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (error && typeof error === 'object') {
		const body = error as { error?: unknown; message?: unknown };
		const envelope =
			body.error && typeof body.error === 'object'
				? (body.error as { code?: unknown; message?: unknown })
				: null;
		const envelopeMessage = typeof envelope?.message === 'string' ? envelope.message : undefined;
		const topLevelMessage = typeof body.message === 'string' ? body.message : undefined;
		const message = envelopeMessage ?? topLevelMessage;

		// Structured Parchment envelope: `{ error: { code: "schema_unavailable", message } }`.
		if (envelope?.code === 'schema_unavailable') {
			return new CatalogSchemaUnavailableError(message ?? 'Catalog schema unavailable');
		}

		// Legacy/flat body shape kept for backward compatibility.
		if (body.error === 'Catalog schema unavailable') {
			return new CatalogSchemaUnavailableError(message ?? 'Catalog schema unavailable');
		}

		if (message) {
			return new Error(message);
		}
	}

	return new Error(typeof error === 'string' ? error : 'Catalog request failed');
}

function extractParchmentCatalogBody(result: CatalogListResult): CatalogListBody {
	if (result.error) {
		throw normalizeCatalogListError(result.error);
	}

	if (Array.isArray(result.data)) {
		return { data: result.data, pagination: { total: result.data.length } };
	}

	return result.data ?? { data: [], pagination: { total: 0 } };
}

function extractParchmentCatalogRows(body: CatalogListBody): SdkCatalogItem[] {
	return Array.isArray(body.data) ? (body.data as SdkCatalogItem[]) : [];
}

function getParchmentCatalogTotal(body: CatalogListBody, rows: SdkCatalogItem[]): number {
	return typeof body.pagination?.total === 'number' ? body.pagination.total : rows.length;
}

function isCatalogSchemaUnavailableError(error: unknown): error is Error {
	return (
		error instanceof Error &&
		(error.name === 'CatalogSchemaUnavailableError' ||
			error.name === 'ParchmentConfigError' ||
			error.message.includes('Structured process filters are unavailable'))
	);
}

function stripProcessFacetFilters(state: CatalogUrlState): CatalogUrlState {
	const filters = { ...state.filters };
	for (const key of PROCESS_FACET_FILTER_KEYS) {
		delete filters[key];
	}

	return {
		...state,
		filters
	};
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const requestedCatalogState = parseCatalogUrlState(url, '/catalog');
	const catalogAccess = resolveCatalogAccessCapabilities({
		principal: locals.principal,
		session: locals.session,
		role: locals.role
	});
	const deniedProcessParams = catalogAccess.canUseProcessFacets
		? []
		: getRequestedProcessFacetParams(url.searchParams);
	const catalogAccessNotice: CatalogAccessDeniedNotice | null = createProcessFacetDeniedNotice({
		isAuthenticated: locals.principal?.isAuthenticated ?? Boolean(locals.session),
		deniedParams: deniedProcessParams
	});
	const authorizedCatalogState = catalogAccess.canUseProcessFacets
		? requestedCatalogState
		: stripProcessFacetFilters(requestedCatalogState);
	const visibility = resolveCatalogVisibility({
		session: locals.session,
		role: locals.role,
		showWholesaleRequested: authorizedCatalogState.showWholesale,
		wholesaleOnlyRequested: url.searchParams.get('wholesaleOnly') === 'true'
	});
	const initialCatalogState: CatalogUrlState = {
		...authorizedCatalogState,
		showWholesale: visibility.showWholesale,
		wholesaleOnly: visibility.wholesaleOnly
	};
	const deepLinkCoffeeId = parseCatalogDeepLinkCoffeeId(url.searchParams.get('coffee'));
	let catalogData: SdkCatalogItem[] = [];
	let count: number | null = 0;
	let catalogSchemaUnavailable: { message: string } | null = null;

	const userId = locals.principal?.isAuthenticated ? locals.principal.userId : null;
	const isMember = locals.role === 'member' || locals.role === 'admin';
	const hasParchmentAccess =
		isMember || (locals.principal?.isAuthenticated === true && locals.principal.ppiAccess === true);
	// Watchlist-only view: restrict results to the user's tracked lots, including
	// delisted ones, so the whole watchlist is reviewable in one place.
	const trackedOnly =
		url.searchParams.get('tracked') === 'only' && Boolean(userId && hasParchmentAccess);

	let trackedLotIds: number[] = [];
	if (trackedOnly && userId) {
		trackedLotIds = await getTrackedLotIds(locals.supabase, userId);
	}

	// Reused for both the catalog list and the origin-price-stats read below so the
	// two Parchment calls present the same principal and share one client per load.
	let catalogClient: ParchmentClient | null = null;

	try {
		if (!trackedOnly || trackedLotIds.length > 0) {
			const client = await createParchmentServerClient(event, {
				mode: resolveCatalogCredentialMode(locals)
			});
			catalogClient = client;
			const effectiveCatalogState = trackedOnly
				? {
						...initialCatalogState,
						showWholesale: true,
						wholesaleOnly: false
					}
				: initialCatalogState;
			const catalogResult = (await client.catalog.list(
				buildParchmentCatalogQuery(effectiveCatalogState, {
					stocked: trackedOnly ? 'all' : 'true',
					...(trackedOnly ? { coffeeIds: trackedLotIds, limit: TRACKED_VIEW_LIMIT, page: 1 } : {})
				}) as CatalogListQuery
			)) as CatalogListResult;
			const catalogBody = extractParchmentCatalogBody(catalogResult);
			catalogData = extractParchmentCatalogRows(catalogBody);
			count = getParchmentCatalogTotal(catalogBody, catalogData);

			const shouldFetchDeepLinkCoffee =
				deepLinkCoffeeId !== null &&
				!catalogData.some((coffee) => coffee.id === deepLinkCoffeeId) &&
				(!trackedOnly || trackedLotIds.includes(deepLinkCoffeeId));

			if (shouldFetchDeepLinkCoffee) {
				const deepLinkCatalogState: CatalogUrlState = {
					...effectiveCatalogState,
					filters: {},
					sortField: null,
					sortDirection: null
				};
				const deepLinkResult = (await client.catalog.list(
					buildParchmentCatalogQuery(deepLinkCatalogState, {
						stocked: 'all',
						coffeeIds: [deepLinkCoffeeId],
						limit: 1,
						page: 1
					}) as CatalogListQuery
				)) as CatalogListResult;
				const deepLinkBody = extractParchmentCatalogBody(deepLinkResult);
				const deepLinkRows = extractParchmentCatalogRows(deepLinkBody);

				if (deepLinkRows.length > 0) {
					catalogData = [...deepLinkRows, ...catalogData];
				}
			}
		}
	} catch (error) {
		if (!isCatalogSchemaUnavailableError(error)) {
			throw error;
		}

		catalogSchemaUnavailable = { message: error.message };
	}

	const catalogResources = (catalogData ?? []).map((item) =>
		toCatalogResourceItem(item as Parameters<typeof toCatalogResourceItem>[0])
	);

	// Per-origin price context now comes from Parchment (same source, same client,
	// same credential as the catalog list above). Forward the resolved wholesale
	// view params; publicOnly is derived server-side from the credential. Non-fatal:
	// a stats failure degrades to an empty context panel rather than failing the
	// whole (public) catalog page.
	let originPriceStats: CatalogOriginPriceStats = [];
	if (catalogClient) {
		try {
			const statsQuery: CatalogOriginPriceStatsQuery = {};
			if (visibility.showWholesale) statsQuery.showWholesale = 'true';
			if (visibility.wholesaleOnly) statsQuery.wholesaleOnly = 'true';

			const { data } = await catalogClient.catalog.originPriceStats(statsQuery);
			originPriceStats = data?.originPriceStats ?? [];
		} catch (error) {
			console.error('Error loading origin price stats from Parchment:', error);
		}
	}

	let briefMatchSummaries: BriefMatchSummary[] = [];

	if (userId && hasParchmentAccess) {
		const [tracked, briefs] = await Promise.all([
			trackedOnly ? Promise.resolve(trackedLotIds) : getTrackedLotIds(locals.supabase, userId),
			isMember
				? getBriefMatchSummaries(
						locals.supabase,
						userId,
						catalogData as Parameters<typeof getBriefMatchSummaries>[2]
					)
				: Promise.resolve([])
		]);
		trackedLotIds = tracked;
		briefMatchSummaries = briefs;
	}

	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateCoffeeCollectionSchema(
			catalogResources as Record<string, unknown>[],
			`${baseUrl}/catalog`
		)
	]);

	return {
		data: catalogResources,
		trainingData: catalogResources,
		initialCatalogState,
		originPriceStats,
		ppiAccess:
			locals.principal?.isAuthenticated === true ? locals.principal.ppiAccess === true : false,
		trackedLotIds,
		trackedOnly,
		briefMatchSummaries,
		catalogAccess,
		catalogAccessNotice,
		catalogSchemaUnavailable,
		pagination: trackedOnly
			? buildPagination(
					{
						...initialCatalogState,
						pagination: { page: 1, limit: TRACKED_VIEW_LIMIT }
					},
					count ?? catalogResources.length
				)
			: buildPagination(initialCatalogState, count ?? catalogResources.length),
		meta: buildPublicMeta({
			baseUrl,
			path: '/catalog',
			title: 'Green Coffee Catalog — 1,200+ Specialty Coffees | Purveyors',
			description:
				'Browse 1,200+ specialty and commercial green coffees from 39+ US importers and roasters. Filter by origin, processing method, altitude, and price. Updated daily with real-time inventory.',
			keywords: [
				'green coffee',
				'specialty coffee catalog',
				'green coffee prices',
				'Ethiopian green coffee',
				'Colombian green coffee',
				'washed natural honey processing',
				'coffee importers',
				'green coffee suppliers',
				'buy green coffee',
				'coffee roasters'
			],
			ogTitle: 'Green Coffee Catalog — 1,200+ Specialty Coffees | Purveyors',
			ogDescription:
				'Browse 1,200+ specialty green coffees from 39+ US suppliers. Filter by Ethiopian, Colombian, and Guatemalan origins; washed, natural, and honey processing; plus real-time pricing and daily inventory updates.',
			twitterTitle: 'Green Coffee Catalog | Purveyors',
			twitterDescription:
				'1,200+ specialty green coffees from 39+ US importers. Origin, processing, altitude, and daily pricing.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/catalog.jpg',
				alt: 'Purveyors catalog social preview card'
			}),
			schemaData
		})
	};
};
