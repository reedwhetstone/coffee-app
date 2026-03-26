import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Progressive hydration: load a small public preview for SSR; the client hydrates
	// from the canonical /v1/catalog resource after mount.
	let catalogQuery = locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.eq('wholesale', false)
		.order('arrival_date', { ascending: false })
		.limit(5);

	if (!locals.session) {
		catalogQuery = catalogQuery.eq('public_coffee', true);
	}

	const { data: stockedData } = await catalogQuery;

	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateCoffeeCollectionSchema(
			(stockedData ?? []) as Record<string, unknown>[],
			`${baseUrl}/catalog`
		)
	]);

	return {
		data: stockedData || [],
		trainingData: stockedData || [],
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
