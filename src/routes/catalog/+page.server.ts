import type { PageServerLoad } from './$types';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get recent stocked coffees with smaller initial limit for better performance
	// Load first 50 items quickly, implement pagination for rest
	const { data: stockedData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.order('arrival_date', { ascending: false });
	//.limit(50); // temporarily no reduced limit for faster initial load, unless comprehensive fix is addressed. simply limiting the initial load doesn't address the need for all the data in the search and for infinite scroll.

	// Generate schema for authenticated coffee catalog page
	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);

	// Authenticated users see full coffee platform with collection data
	const schemaData = schemaService.generatePageSchema('homepage', baseUrl, {
		coffees: stockedData
	});

	// Catalog-specific meta information
	const metaInfo = {
		title: 'Purveyors - Coffee Marketplace & Roasting Platform',
		description:
			'Browse premium green coffee, track roasts, and manage your coffee business with AI-powered recommendations and comprehensive analytics.',
		ogTitle: 'Purveyors Coffee Platform - Premium Green Coffee Marketplace',
		ogDescription:
			'Discover premium green coffee with AI recommendations, roast tracking, and business analytics.',
		twitterTitle: 'Purveyors Coffee Platform',
		twitterDescription:
			'Premium green coffee marketplace with AI recommendations and roast tracking.'
	};

	return {
		data: stockedData || [],
		trainingData: stockedData || [],
		meta: {
			...metaInfo,
			keywords:
				'coffee roasting, green coffee, coffee API, roast tracking, coffee inventory, specialty coffee, coffee platform',
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
