import type { PageServerLoad } from '../(home)/$types';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get limited coffee data for preview section
	const { data: stockedData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.order('arrival_date', { ascending: false })
		.limit(6); // Only need 6 for preview

	// Generate marketing landing page schema
	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generatePageSchema('homepage-marketing', baseUrl);

	// Marketing landing page meta information
	const metaInfo = {
		title: 'Purveyors - Professional Coffee Roasting Platform & Green Coffee API',
		description:
			'Professional coffee roasting platform with inventory management, roast tracking, profit analytics, and the first normalized green coffee API for developers.',
		ogTitle: 'Purveyors - Professional Coffee Roasting Platform',
		ogDescription:
			'The complete platform for coffee roasters with inventory management, roast tracking, and the first normalized green coffee API.',
		twitterTitle: 'Purveyors - Professional Coffee Roasting Platform',
		twitterDescription:
			'Professional coffee roasting platform with inventory management, roast tracking, and green coffee API.'
	};

	return {
		data: stockedData || [],
		trainingData: stockedData || [],
		meta: {
			...metaInfo,
			keywords:
				'coffee roasting, green coffee, coffee API, roast tracking, coffee inventory, specialty coffee, coffee platform',
			canonical: baseUrl,
			ogImage: `${baseUrl}/purveyors_orange.svg`,
			ogUrl: baseUrl,
			ogType: 'website',
			twitterCard: 'summary_large_image',
			twitterImage: `${baseUrl}/purveyors_orange.svg`,
			schemaData
		}
	};
};
