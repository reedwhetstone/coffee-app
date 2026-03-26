import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get session data - no longer redirecting server-side for better performance
	const { session } = await locals.safeGetSession();

	// Get limited coffee data for preview section with error handling
	let stockedData: Record<string, unknown>[] = [];
	try {
		const result = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			orderBy: 'arrival_date',
			orderDirection: 'desc',
			limit: 6 // Only need 6 for preview
		});
		stockedData = result.data as unknown as Record<string, unknown>[];
	} catch (error) {
		console.error('Error loading coffee catalog:', error);
		// Continue with empty array, don't block page load
	}

	const baseUrl = `${url.protocol}//${url.host}`;

	// Generate marketing landing page schema with error handling
	let schemaData = {};
	try {
		const schemaService = createSchemaService(baseUrl);
		schemaData = schemaService.generatePageSchema('homepage-marketing', baseUrl);
	} catch (error) {
		console.error('Error generating schema data:', error);
		// Continue without schema data
	}

	return {
		session, // Include session data for client-side redirect logic
		data: stockedData,
		trainingData: stockedData,
		meta: buildPublicMeta({
			baseUrl,
			path: '/',
			title: 'Purveyors - Professional Coffee Roasting Platform & Green Coffee API',
			description:
				'Professional coffee roasting platform with inventory management, roast tracking, profit analytics, and the first normalized green coffee API for developers.',
			keywords: [
				'coffee roasting',
				'green coffee',
				'coffee API',
				'roast tracking',
				'coffee inventory',
				'specialty coffee',
				'coffee platform'
			],
			ogTitle: 'Purveyors - Professional Coffee Roasting Platform',
			ogDescription:
				'The complete platform for coffee roasters with inventory management, roast tracking, and the first normalized green coffee API.',
			twitterTitle: 'Purveyors - Professional Coffee Roasting Platform',
			twitterDescription:
				'Professional coffee roasting platform with inventory management, roast tracking, and green coffee API.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/home.jpg',
				alt: 'Purveyors homepage social preview card'
			}),
			schemaData
		})
	};
};
