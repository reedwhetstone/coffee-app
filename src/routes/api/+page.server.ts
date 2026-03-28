import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { createSchemaService } from '$lib/services/schemaService';
import { generateBreadcrumbs } from '$lib/utils/breadcrumbs';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const pageUrl = `${baseUrl}/api`;
	const schemaService = createSchemaService(baseUrl);
	const breadcrumbs = generateBreadcrumbs(url.pathname, baseUrl);

	const serviceData = {
		name: 'Parchment API',
		description:
			'Normalized green coffee catalog access, market analytics, and a unified docs path for Parchment Platform on Purveyors.',
		provider: 'Purveyors',
		serviceType: 'Data API',
		url: pageUrl,
		features: [
			'Public catalog feed via API key',
			'Unified public docs under /docs',
			'Account-aware key and usage tooling in Parchment Console',
			'Live market analytics in the web app',
			'CLI and agent workflows through @purveyors/cli'
		],
		audience: [
			'Coffee software teams',
			'Roasters and sourcing operators',
			'Data consumers',
			'Agents and automation workflows'
		]
	};

	const pricingTiers = [
		{
			name: 'Explorer',
			price: 0,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Free tier for evaluation and lightweight catalog pulls',
			features: ['200 requests per month', '25 rows per call', 'Parchment Console access'],
			popular: false
		},
		{
			name: 'Roaster+',
			price: 99,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Production catalog integrations and higher-volume syncing',
			features: ['10,000 requests per month', 'Unlimited rows per call', 'Usage analytics'],
			popular: true
		},
		{
			name: 'Enterprise',
			price: 0,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Custom volume, unlimited request ceilings, and premium support',
			features: ['Unlimited requests', 'Unlimited rows per call', 'Custom commercial terms'],
			popular: false
		}
	];

	const faqs = [
		{
			question: 'Which API route is public today?',
			answer:
				'The stable external route is GET /api/catalog-api. It uses API-key auth and returns publicly visible catalog rows with tier-based row limits.'
		},
		{
			question: 'Are analytics exposed as a public REST API?',
			answer:
				'Not yet. Analytics are a major product surface in the web app at /analytics, with deeper authenticated and premium analytics views, but they are not currently sold as a separate public API-key endpoint family.'
		},
		{
			question: 'Where do I generate keys and inspect usage?',
			answer:
				'Use /api-dashboard to open Parchment Console, create keys, review monthly usage, and confirm your current tier and limits.'
		},
		{
			question: 'How does the CLI fit in?',
			answer:
				'The CLI is a first-class interface to the platform. The web app imports @purveyors/cli modules directly for several AI and workflow features, so CLI and app behavior stay aligned.'
		}
	];

	const schemaData = schemaService.generatePageSchema('api-service', pageUrl, {
		service: serviceData,
		pricing: pricingTiers,
		faqs,
		breadcrumbs
	});

	return {
		meta: buildPublicMeta({
			baseUrl,
			path: '/api',
			title: 'Parchment API | Green Coffee Catalog and Market Intelligence',
			description:
				'Access the Parchment API catalog feed, Parchment Console, and unified Parchment API plus CLI docs.',
			keywords: [
				'green coffee API',
				'coffee catalog API',
				'coffee market analytics',
				'purveyors cli',
				'coffee sourcing data'
			],
			ogTitle: 'Parchment API',
			ogDescription:
				'Normalized green coffee catalog access, market analytics, and unified documentation for Parchment Platform on Purveyors.',
			twitterTitle: 'Parchment API',
			twitterDescription:
				'Catalog data, analytics, Parchment Console tooling, and CLI workflows on Purveyors.',
			type: 'product',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/api.jpg',
				alt: 'Parchment API social preview card'
			}),
			schemaData
		})
	};
};
