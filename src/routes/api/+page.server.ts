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
			'Live green coffee catalog data, supplier coverage, and market visibility for roasters and coffee software teams.',
		provider: 'Purveyors',
		serviceType: 'Data API',
		url: pageUrl,
		features: [
			'Daily-updated catalog data from 39+ suppliers',
			'One consistent feed for pricing, origin, process, and availability',
			'Parchment Console for API keys and usage tracking',
			'Market analytics for price and supplier monitoring',
			'Implementation docs and onboarding guidance'
		],
		audience: [
			'Coffee software teams',
			'Roasters and sourcing teams',
			'Operators and analysts',
			'Internal product teams'
		]
	};

	const pricingTiers = [
		{
			name: 'Green',
			price: 0,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Free plan for evaluation and lightweight data pulls',
			features: ['200 requests per month', '25 rows per call', 'Parchment Console access'],
			popular: false
		},
		{
			name: 'Origin',
			price: 99,
			currency: 'USD',
			billingDuration: 'P1M',
			description:
				'Self-serve plan for production integrations, sync jobs, and recurring customer use',
			features: ['10,000 requests per month', 'Unlimited rows per call', 'Usage visibility'],
			popular: true
		},
		{
			name: 'Enterprise',
			price: 0,
			currency: 'USD',
			billingDuration: 'P1M',
			description:
				'Contact-sales plan for larger deployments, custom volume, and premium support',
			features: [
				'Unlimited requests',
				'Unlimited rows per call',
				'Custom support and commercial terms'
			],
			popular: false
		}
	];

	const faqs = [
		{
			question: 'What can I access with Parchment API today?',
			answer:
				'You can access the green coffee catalog feed, including pricing, origin, processing, availability, and supplier coverage through one documented API.'
		},
		{
			question: 'Who is this best for?',
			answer:
				'Parchment API is built for roasters, coffee software teams, analysts, and internal product teams that want reliable green coffee data without stitching together supplier listings by hand.'
		},
		{
			question: 'How do I get keys and review usage?',
			answer:
				'Use Parchment Console at /api-dashboard to create keys, review monthly usage, and confirm your current plan and limits.'
		},
		{
			question: 'Can I explore the product before committing to a paid plan?',
			answer:
				'Yes. The Green plan is free and designed for evaluation, prototypes, and lightweight testing before you move to a production plan.'
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
			title: 'Parchment API | Live Green Coffee Data for Products and Teams',
			description:
				'Add live green coffee catalog data to your product with one API. Daily updates, clear pricing, and fast onboarding for roasters and coffee software teams.',
			keywords: [
				'green coffee API',
				'coffee catalog API',
				'coffee supplier data',
				'coffee market data',
				'coffee sourcing API'
			],
			ogTitle: 'Parchment API',
			ogDescription:
				'Live green coffee catalog data, supplier coverage, and market visibility for roasters and coffee software teams.',
			twitterTitle: 'Parchment API',
			twitterDescription:
				'Add daily-updated green coffee catalog data to your product with clear pricing and fast onboarding.',
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
