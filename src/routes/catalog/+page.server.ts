import type { PageServerLoad } from './$types';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Progressive hydration: Load minimal initial data for faster SSR
	// Client will lazy-load remaining items for better perceived performance
	const { data: stockedData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.eq('wholesale', false)
		.order('arrival_date', { ascending: false })
		.limit(5); // Reduced for faster initial load - remaining items loaded client-side

	// Generate schema for public coffee catalog page
	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);

	// Coffee collection schema for catalog page
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateCoffeeCollectionSchema(
			(stockedData ?? []) as Record<string, unknown>[],
			`${baseUrl}/catalog`
		)
	]);

	// Catalog-specific meta information
	const metaInfo = {
		title: 'Green Coffee Catalog — 1,200+ Specialty Coffees | Purveyors',
		description:
			'Browse 1,200+ specialty and commercial green coffees from 39+ US importers and roasters. Filter by origin, processing method, altitude, and price. Updated daily with real-time inventory.',
		ogTitle: 'Green Coffee Catalog — 1,200+ Specialty Coffees | Purveyors',
		ogDescription:
			'Browse 1,200+ specialty green coffees from 39+ US suppliers. Filter by Ethiopian, Colombian, Guatemalan origins; washed, natural, and honey processing. Real-time pricing and daily inventory updates.',
		twitterTitle: 'Green Coffee Catalog | Purveyors',
		twitterDescription:
			'1,200+ specialty green coffees from 39+ US importers. Origin, processing, altitude, and daily pricing.'
	};

	return {
		data: stockedData || [],
		trainingData: stockedData || [],
		meta: {
			...metaInfo,
			keywords:
				'green coffee, specialty coffee catalog, green coffee prices, Ethiopian green coffee, Colombian green coffee, washed natural honey processing, coffee importers, green coffee suppliers, buy green coffee, coffee roasters',
			canonical: `${baseUrl}/catalog`,
			ogImage: `${baseUrl}/purveyors_orange.svg`,
			ogUrl: `${baseUrl}/catalog`,
			ogType: 'website',
			twitterCard: 'summary_large_image',
			twitterImage: `${baseUrl}/purveyors_orange.svg`,
			schemaData
		}
	};
};
