import type { PageServerLoad } from '../(home)/$types';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get session data - no longer redirecting server-side for better performance
	const { session } = await locals.safeGetSession();

	// Get limited coffee data for preview section with error handling
	let stockedData: Record<string, unknown>[] = [];
	try {
		const { data, error } = await locals.supabase
			.from('coffee_catalog')
			.select('*')
			.eq('stocked', true)
			.order('arrival_date', { ascending: false })
			.limit(6); // Only need 6 for preview

		if (error) {
			console.warn('Failed to load coffee catalog for home preview:', error);
		} else {
			stockedData = data || [];
		}
	} catch (error) {
		console.error('Error loading coffee catalog:', error);
		// Continue with empty array, don't block page load
	}

	// Generate marketing landing page schema with error handling
	let schemaData = {};
	try {
		const baseUrl = `${url.protocol}//${url.host}`;
		const schemaService = createSchemaService(baseUrl);
		schemaData = schemaService.generatePageSchema('homepage-marketing', baseUrl);
	} catch (error) {
		console.error('Error generating schema data:', error);
		// Continue without schema data
	}

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
		session, // Include session data for client-side redirect logic
		data: stockedData,
		trainingData: stockedData,
		meta: {
			...metaInfo,
			keywords:
				'coffee roasting, green coffee, coffee API, roast tracking, coffee inventory, specialty coffee, coffee platform',
			canonical: `${url.protocol}//${url.host}`,
			ogImage: `${url.protocol}//${url.host}/purveyors_orange.svg`,
			ogUrl: `${url.protocol}//${url.host}`,
			ogType: 'website',
			twitterCard: 'summary_large_image',
			twitterImage: `${url.protocol}//${url.host}/purveyors_orange.svg`,
			schemaData
		}
	};
};
