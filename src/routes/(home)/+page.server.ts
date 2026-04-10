import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, role } = await locals.safeGetSession();
	const visibility = resolveCatalogVisibility({ session, role });

	let stockedData: Record<string, unknown>[] = [];
	try {
		const result = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			publicOnly: visibility.publicOnly,
			showWholesale: visibility.showWholesale,
			wholesaleOnly: visibility.wholesaleOnly,
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
			title: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
			description:
				'Browse normalized green coffee listings, recent arrivals, and the API-first coffee intelligence platform built for roasters, buyers, and developers.',
			keywords: [
				'green coffee catalog',
				'coffee intelligence',
				'coffee sourcing',
				'green coffee API',
				'coffee data platform',
				'coffee roaster software',
				'specialty coffee'
			],
			ogTitle: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
			ogDescription:
				'Explore recent arrivals, normalized sourcing data, and the API-first coffee platform built for roasters and developers.',
			twitterTitle: 'Purveyors - Live Green Coffee Catalog & Coffee Intelligence',
			twitterDescription:
				'Browse live green coffee data, compare recent arrivals, and explore the API-first coffee intelligence platform for roasters.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/home.jpg',
				alt: 'Purveyors homepage social preview card'
			}),
			schemaData
		})
	};
};
