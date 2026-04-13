import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import {
	HOMEPAGE_MARKETING_DESCRIPTION,
	HOMEPAGE_MARKETING_KEYWORDS,
	HOMEPAGE_MARKETING_OG_DESCRIPTION,
	HOMEPAGE_MARKETING_PREVIEW_QUERY,
	HOMEPAGE_MARKETING_SOCIAL_IMAGE,
	HOMEPAGE_MARKETING_TITLE,
	HOMEPAGE_MARKETING_TWITTER_DESCRIPTION
} from '$lib/public-contracts/homepage';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, role } = await locals.safeGetSession();
	const visibility = resolveCatalogVisibility({ session, role });

	let stockedData: Record<string, unknown>[] = [];
	try {
		const result = await searchCatalog(locals.supabase, {
			...HOMEPAGE_MARKETING_PREVIEW_QUERY,
			publicOnly: visibility.publicOnly,
			showWholesale: visibility.showWholesale,
			wholesaleOnly: visibility.wholesaleOnly
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
			title: HOMEPAGE_MARKETING_TITLE,
			description: HOMEPAGE_MARKETING_DESCRIPTION,
			keywords: [...HOMEPAGE_MARKETING_KEYWORDS],
			ogTitle: HOMEPAGE_MARKETING_TITLE,
			ogDescription: HOMEPAGE_MARKETING_OG_DESCRIPTION,
			twitterTitle: HOMEPAGE_MARKETING_TITLE,
			twitterDescription: HOMEPAGE_MARKETING_TWITTER_DESCRIPTION,
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: HOMEPAGE_MARKETING_SOCIAL_IMAGE.preferredPath,
				alt: HOMEPAGE_MARKETING_SOCIAL_IMAGE.alt
			}),
			schemaData
		})
	};
};
