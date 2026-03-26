import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();

	let stockedData: Record<string, unknown>[] = [];
	try {
		const result = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			orderBy: 'arrival_date',
			orderDirection: 'desc',
			limit: 6
		});
		stockedData = result.data as unknown as Record<string, unknown>[];
	} catch (error) {
		console.error('Error loading homepage coffee preview:', error);
	}

	const baseUrl = `${url.protocol}//${url.host}`;

	let schemaData = {};
	try {
		const schemaService = createSchemaService(baseUrl);
		schemaData = schemaService.generatePageSchema('homepage-marketing', baseUrl);
	} catch (error) {
		console.error('Error generating homepage schema data:', error);
	}

	return {
		session,
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
