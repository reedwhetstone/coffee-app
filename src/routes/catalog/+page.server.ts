import type { PageServerLoad } from './$types';
import { CatalogSchemaUnavailableError, searchCatalog } from '$lib/data/catalog';
import { toCatalogResourceItem } from '$lib/catalog/catalogResourceItem';
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
import { loadCatalogOriginPriceStats } from '$lib/server/catalogOriginPriceStats';
import { getTrackedLotIds } from '$lib/server/trackedLots';
import { getBriefMatchSummaries, type BriefMatchSummary } from '$lib/server/briefMatchSummary';

// Watchlist-only view is served as a single page; tracked lists are small.
const TRACKED_VIEW_LIMIT = 200;

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

export const load: PageServerLoad = async ({ locals, url }) => {
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
	const searchState = catalogUrlStateToSearchState(initialCatalogState);
	let catalogData: Awaited<ReturnType<typeof searchCatalog>>['data'] = [];
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

	try {
		if (!trackedOnly || trackedLotIds.length > 0) {
			const catalogResult = await searchCatalog(locals.supabase, {
				stockedOnly: !trackedOnly,
				publicOnly: visibility.publicOnly,
				showWholesale: trackedOnly ? true : visibility.showWholesale,
				wholesaleOnly: trackedOnly ? false : visibility.wholesaleOnly,
				fields: 'resource',
				...searchState,
				...(trackedOnly ? { coffeeIds: trackedLotIds, limit: TRACKED_VIEW_LIMIT, offset: 0 } : {})
			});
			catalogData = catalogResult.data;
			count = catalogResult.count;
		}
	} catch (error) {
		if (!(error instanceof CatalogSchemaUnavailableError)) {
			throw error;
		}

		catalogSchemaUnavailable = { message: error.message };
	}

	const catalogResources = (catalogData ?? []).map(toCatalogResourceItem);

	const originPriceStats = await loadCatalogOriginPriceStats(locals.supabase, visibility);

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
