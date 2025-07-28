import type { PageServerLoad } from '../(home)/$types';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication state
	const {
		data: { session }
	} = await locals.supabase.auth.getSession();
	const isAuthenticated = !!session;

	// Get recent stocked coffees with smaller initial limit for better performance
	// Load first 50 items quickly, implement pagination for rest
	const { data: stockedData } = await locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true)
		.order('arrival_date', { ascending: false });
	//.limit(50); // temporarily no reduced limit for faster initial load, unless comprehensive fix is addressed. simply limiting the initial load doesn't address the need for all the data in the search and for infinite scroll.

	// Generate conditional schema based on authentication state
	const baseUrl = `${url.protocol}//${url.host}`;
	const schemaService = createSchemaService(baseUrl);

	let schemaData;
	if (isAuthenticated) {
		// Authenticated users see full coffee platform with collection data
		schemaData = schemaService.generatePageSchema('homepage', baseUrl, {
			coffees: stockedData
		});
	} else {
		// Non-authenticated users see marketing landing page without coffee data
		schemaData = schemaService.generatePageSchema('homepage-marketing', baseUrl);
	}

	// Conditional meta information based on authentication
	const metaInfo = isAuthenticated
		? {
				title: 'Purveyors - Coffee Marketplace & Roasting Platform',
				description:
					'Browse premium green coffee, track roasts, and manage your coffee business with AI-powered recommendations and comprehensive analytics.',
				ogTitle: 'Purveyors Coffee Platform - Premium Green Coffee Marketplace',
				ogDescription:
					'Discover premium green coffee with AI recommendations, roast tracking, and business analytics.',
				twitterTitle: 'Purveyors Coffee Platform',
				twitterDescription:
					'Premium green coffee marketplace with AI recommendations and roast tracking.'
			}
		: {
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
