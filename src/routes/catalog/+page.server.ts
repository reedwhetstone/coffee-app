import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const requestedCatalogState = parseCatalogUrlState(url, '/catalog');
	const visibility = resolveCatalogVisibility({
		session: locals.session,
		role: locals.role,
		showWholesaleRequested: requestedCatalogState.showWholesale
	});
	const initialCatalogState: CatalogUrlState = {
		...requestedCatalogState,
		showWholesale: visibility.showWholesale
	};
	const searchState = catalogUrlStateToSearchState(initialCatalogState);
	const { data: catalogData, count } = await searchCatalog(locals.supabase, {
		stockedOnly: true,
		publicOnly: visibility.publicOnly,
		showWholesale: visibility.showWholesale,
		wholesaleOnly: visibility.wholesaleOnly,
		...searchState
	});

	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateCoffeeCollectionSchema(
			(catalogData ?? []) as Record<string, unknown>[],
			`${baseUrl}/catalog`
		)
	]);

	return {
		data: catalogData || [],
		trainingData: catalogData || [],
		initialCatalogState,
		pagination: buildPagination(initialCatalogState, count || catalogData.length),
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
