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
		showWholesaleRequested: authorizedCatalogState.showWholesale
	});
	const initialCatalogState: CatalogUrlState = {
		...authorizedCatalogState,
		showWholesale: visibility.showWholesale
	};
	const searchState = catalogUrlStateToSearchState(initialCatalogState);
	let catalogData: Awaited<ReturnType<typeof searchCatalog>>['data'] = [];
	let count: number | null = 0;
	let catalogSchemaUnavailable: { message: string } | null = null;

	try {
		const catalogResult = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			publicOnly: visibility.publicOnly,
			showWholesale: visibility.showWholesale,
			wholesaleOnly: visibility.wholesaleOnly,
			fields: 'resource',
			...searchState
		});
		catalogData = catalogResult.data;
		count = catalogResult.count;
	} catch (error) {
		if (!(error instanceof CatalogSchemaUnavailableError)) {
			throw error;
		}

		catalogSchemaUnavailable = { message: error.message };
	}

	const catalogResources = (catalogData ?? []).map(toCatalogResourceItem);

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
		catalogAccess,
		catalogAccessNotice,
		catalogSchemaUnavailable,
		pagination: buildPagination(initialCatalogState, count ?? catalogResources.length),
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
