import type { PageServerLoad } from './$types';
import type { CatalogListQuery, components } from '@purveyors/sdk';
import type { CoffeeCatalog } from '$lib/types/component.types';
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

type ParchmentCatalogItem = components['schemas']['CatalogItem'] & Partial<CoffeeCatalog>;

function buildHomepageCatalogQuery(): CatalogListQuery {
	return {
		stocked: HOMEPAGE_MARKETING_PREVIEW_QUERY.stockedOnly ? 'true' : 'all',
		sort: HOMEPAGE_MARKETING_PREVIEW_QUERY.orderBy,
		order: HOMEPAGE_MARKETING_PREVIEW_QUERY.orderDirection,
		limit: HOMEPAGE_MARKETING_PREVIEW_QUERY.limit
	};
}

function toHomepageCoffeeCard(item: ParchmentCatalogItem): CoffeeCatalog {
	return {
		ai_description: item.ai_description ?? null,
		ai_tasting_notes: item.ai_tasting_notes ?? null,
		appearance: item.appearance ?? null,
		arrival_date: item.arrival_date ?? null,
		bag_size: item.bag_size ?? null,
		coffee_user: item.coffee_user ?? null,
		continent: item.continent ?? null,
		cost_lb: item.cost_lb ?? null,
		country: item.country ?? null,
		cultivar_detail: item.cultivar_detail ?? null,
		cupping_notes: item.cupping_notes ?? null,
		description_long: item.description_long ?? null,
		description_short: item.description_short ?? null,
		drying_method: item.drying_method ?? null,
		farm_notes: item.farm_notes ?? null,
		grade: item.grade ?? null,
		id: item.id,
		last_updated: item.last_updated ?? null,
		link: item.link ?? null,
		lot_size: item.lot_size ?? null,
		name: item.name ?? 'Unknown coffee',
		packaging: item.packaging ?? null,
		price_per_lb: item.price_per_lb ?? null,
		price_tiers: item.price_tiers ?? null,
		purveyor_score: item.purveyor_score ?? null,
		purveyor_score_confidence: item.purveyor_score_confidence ?? null,
		purveyor_score_factors: item.purveyor_score_factors ?? {},
		purveyor_score_tier: item.purveyor_score_tier ?? null,
		purveyor_score_updated_at: item.purveyor_score_updated_at ?? null,
		purveyor_score_version: item.purveyor_score_version ?? 'unknown',
		processing: item.processing ?? null,
		processing_base_method: item.processing_base_method ?? null,
		fermentation_type: item.fermentation_type ?? null,
		process_additives: item.process_additives ?? null,
		process_additive_detail: item.process_additive_detail ?? null,
		fermentation_duration_hours: item.fermentation_duration_hours ?? null,
		processing_notes: item.processing_notes ?? null,
		processing_disclosure_level: item.processing_disclosure_level ?? null,
		processing_confidence: item.processing_confidence ?? null,
		processing_evidence: item.processing_evidence ?? null,
		processing_evidence_available: item.processing_evidence_available ?? false,
		public_coffee: item.public_coffee ?? true,
		region: item.region ?? null,
		roast_recs: item.roast_recs ?? null,
		score_value: item.score_value ?? null,
		source: item.source ?? null,
		stocked: item.stocked ?? null,
		stocked_date: item.stocked_date ?? null,
		type: item.type ?? null,
		unstocked_date: item.unstocked_date ?? null,
		subregion: item.subregion ?? null,
		locality: item.locality ?? null,
		site: item.site ?? null,
		processing_site: item.processing_site ?? null,
		farmer: item.farmer ?? null,
		cooperative: item.cooperative ?? null,
		elevation_min_masl: item.elevation_min_masl ?? null,
		elevation_max_masl: item.elevation_max_masl ?? null,
		wholesale: item.wholesale ?? false
	};
}

function toHomepageCoffeeCards(data: unknown): CoffeeCatalog[] {
	const rows =
		data && typeof data === 'object' && 'data' in data ? (data as { data?: unknown }).data : data;

	if (!Array.isArray(rows)) {
		return [];
	}

	return rows
		.filter(
			(row): row is ParchmentCatalogItem =>
				row != null && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'number'
		)
		.map(toHomepageCoffeeCard);
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const { session } = await locals.safeGetSession();

	let stockedData: CoffeeCatalog[] = [];
	try {
		const client = await createParchmentServerClient(event, { mode: 'public-demo' });
		const result = await client.catalog.list(buildHomepageCatalogQuery());
		const responseError = (result as { error?: unknown }).error;
		if (responseError) {
			throw responseError;
		}
		stockedData = toHomepageCoffeeCards(result.data);
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
