import type { PageServerLoad } from './$types';
import { API_PUBLIC_PLANS, PUBLIC_PRODUCT_CATALOG } from '$lib/billing/publicCatalog';
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
			'Public catalog feed via /v1/catalog with anonymous preview and API-key access',
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

	const pricingTiers = API_PUBLIC_PLANS.map((plan) => ({
		name: plan.name,
		price: plan.key === 'enterprise' ? undefined : plan.price,
		priceLabel: plan.priceLabel,
		currency: 'USD',
		billingDuration: plan.key === 'enterprise' ? undefined : 'P1M',
		description: plan.description,
		features: [
			`${plan.monthlyRequests} requests per month`,
			`${plan.rowsPerCall} rows per call`,
			plan.key === 'enterprise' ? 'Contact sales for custom terms' : 'Parchment Console access'
		],
		popular: plan.key === 'member'
	}));

	const faqs = [
		{
			question: 'What is the difference between Explorer and paid Parchment API?',
			answer:
				'Explorer is the free baseline for evaluation and lightweight catalog pulls. Paid Parchment API is the $99/month self-serve tier for production integrations, sync jobs, and stronger usage allowances.'
		},
		{
			question: 'Which API route is public today?',
			answer:
				'The canonical external route is GET /v1/catalog. It supports anonymous, session, and API-key access. For legacy callers, GET /api/catalog-api remains available as a deprecated API-key-only alias.'
		},
		{
			question: 'Are analytics exposed as a public REST API?',
			answer:
				'Not yet. Analytics live in the web app at /analytics, where Parchment Intelligence unlocks the full market-intelligence surface, but they are not currently sold as a separate public API-key endpoint family.'
		},
		{
			question: 'How does enterprise work?',
			answer:
				'Enterprise is a contact-sales path, not a self-serve checkout tier. Reach out if you need custom integrations, embedded analytics, or higher-volume commercial support.'
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
			title: 'Parchment API | Explorer, Production Access, and Enterprise',
			description: `Start with ${PUBLIC_PRODUCT_CATALOG.parchmentApi.freeTierName}, upgrade to ${PUBLIC_PRODUCT_CATALOG.parchmentApi.productName} at ${PUBLIC_PRODUCT_CATALOG.parchmentApi.monthlyPriceLabel}, or contact sales for enterprise access.`,
			keywords: [
				'green coffee API',
				'coffee catalog API',
				'coffee market analytics',
				'purveyors cli',
				'coffee sourcing data'
			],
			ogTitle: 'Parchment API',
			ogDescription:
				'Normalized green coffee catalog access with a free Explorer baseline, paid self-serve production tier, and a sales-led enterprise path.',
			twitterTitle: 'Parchment API',
			twitterDescription:
				'Explorer, paid Parchment API access, Parchment Console tooling, and CLI workflows on Purveyors.',
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
