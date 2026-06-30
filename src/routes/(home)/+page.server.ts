import type { PageServerLoad } from './$types';
import type { CatalogListQuery } from '@purveyors/sdk';
import {
	HOMEPAGE_MARKETING_DESCRIPTION,
	HOMEPAGE_MARKETING_KEYWORDS,
	HOMEPAGE_MARKETING_OG_DESCRIPTION,
	HOMEPAGE_MARKETING_PREVIEW_QUERY,
	HOMEPAGE_MARKETING_SOCIAL_IMAGE,
	HOMEPAGE_MARKETING_TITLE,
	HOMEPAGE_MARKETING_TWITTER_DESCRIPTION
} from '$lib/public-contracts/homepage';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';

function buildHomepageCatalogQuery(): CatalogListQuery {
	return {
		stocked: HOMEPAGE_MARKETING_PREVIEW_QUERY.stockedOnly ? 'true' : 'all',
		sort: HOMEPAGE_MARKETING_PREVIEW_QUERY.orderBy,
		order: HOMEPAGE_MARKETING_PREVIEW_QUERY.orderDirection,
		limit: HOMEPAGE_MARKETING_PREVIEW_QUERY.limit
	};
}

type CatalogListData = {
	data?: unknown;
};

type CatalogListResult = {
	data?: CatalogListData | unknown[];
	error?: unknown;
};

function extractCatalogRows(
	data: CatalogListData | unknown[] | undefined
): Record<string, unknown>[] {
	const rows = Array.isArray(data) ? data : data?.data;
	return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const { session } = await locals.safeGetSession();

	let stockedData: Record<string, unknown>[] = [];
	try {
		const client = await createParchmentServerClient(event, { mode: 'public-demo' });
		const result = (await client.catalog.list(buildHomepageCatalogQuery())) as CatalogListResult;
		if (result.error) {
			throw result.error;
		}
		stockedData = extractCatalogRows(result.data);
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
