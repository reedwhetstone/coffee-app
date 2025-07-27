import type { PageServerLoad } from './$types';
import { createSchemaService } from '$lib/services/schemaService';
import { generateBreadcrumbs } from '$lib/utils/breadcrumbs';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const pageUrl = `${baseUrl}/api`;
	const schemaService = createSchemaService(baseUrl);
	const breadcrumbs = generateBreadcrumbs(url.pathname, baseUrl);

	// Comprehensive service information matching actual API page content
	const serviceData = {
		name: 'Purveyors Green Coffee API',
		description:
			'The first normalized, daily-updated API for specialty green coffee. Real-time inventory data from top U.S. suppliers with comprehensive coffee details, pricing, and availability.',
		provider: 'Purveyors',
		serviceType: 'Data API',
		url: pageUrl,
		features: [
			'Daily-updated green coffee data',
			'Normalized data from multiple suppliers',
			'Real-time pricing and availability',
			'Comprehensive coffee details and tasting notes',
			'RESTful JSON API',
			'Authentication and rate limiting',
			'Developer documentation and examples'
		],
		audience: [
			'Coffee roasters',
			'Developers and data engineers',
			'Coffee industry professionals',
			'Specialty coffee businesses'
		]
	};

	// Pricing tiers matching actual API page content
	const pricingTiers = [
		{
			name: 'Free',
			price: 0,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Perfect for testing and small-scale development',
			features: [
				'100 API calls per month',
				'Basic coffee data access',
				'Standard rate limiting',
				'Community support'
			],
			popular: false
		},
		{
			name: 'Developer',
			price: 19,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'Ideal for small applications and startups',
			features: [
				'5,000 API calls per month',
				'Full coffee data access',
				'Priority rate limiting',
				'Email support',
				'API documentation access'
			],
			popular: true
		},
		{
			name: 'Professional',
			price: 49,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'For growing businesses and commercial applications',
			features: [
				'25,000 API calls per month',
				'Advanced data features',
				'Custom rate limits',
				'Priority support',
				'Webhook notifications',
				'Analytics dashboard'
			],
			popular: false
		},
		{
			name: 'Enterprise',
			price: 199,
			currency: 'USD',
			billingDuration: 'P1M',
			description: 'For large-scale operations and custom integrations',
			features: [
				'Unlimited API calls',
				'Custom data endpoints',
				'SLA guarantees',
				'Dedicated support',
				'Custom integrations',
				'White-label options'
			],
			popular: false
		}
	];

	// Enhanced FAQ data based on actual API page content
	const faqs = [
		{
			question: 'What makes Purveyors API different from other coffee data sources?',
			answer:
				'Purveyors is the first normalized, daily-updated API specifically for specialty green coffee. We aggregate data from multiple top U.S. suppliers and provide it in a consistent format with real-time pricing and availability.'
		},
		{
			question: 'How fresh is the data?',
			answer:
				'Our data is updated daily through automated scraping of supplier websites. This ensures you always have the most current pricing, availability, and coffee details.'
		},
		{
			question: 'What data fields are included?',
			answer:
				'Each coffee entry includes origin details (country, region, farm), processing method, tasting notes, pricing per pound, availability status, arrival dates, grade information, and supplier details.'
		},
		{
			question: 'Do you offer webhook notifications?',
			answer:
				'Yes, Professional and Enterprise plans include webhook notifications for price changes, new coffee arrivals, and availability updates.'
		},
		{
			question: 'Is there an SLA for API uptime?',
			answer:
				'Enterprise customers receive SLA guarantees with 99.9% uptime commitment. All other plans benefit from our robust infrastructure but without formal SLA coverage.'
		},
		{
			question: 'Can I get historical pricing data?',
			answer:
				'Yes, Professional and Enterprise plans include access to historical pricing trends and seasonal availability patterns for market analysis.'
		}
	];

	// Generate comprehensive schema for API service page
	const schemaData = schemaService.generatePageSchema('api-service', pageUrl, {
		service: serviceData,
		pricing: pricingTiers,
		faqs: faqs,
		breadcrumbs
	});

	return {
		meta: {
			title: 'Purveyors.io Green Coffee API - Transform Your Roasting Platform',
			description:
				'The first normalized, daily-updated API for specialty green coffee. Integrate real-time green coffee data into your roasting software with our comprehensive REST API.',
			keywords:
				'green coffee API, coffee data API, specialty coffee API, roasting software integration, coffee inventory API, normalized coffee data',
			canonical: pageUrl,
			ogTitle: 'Purveyors Green Coffee API - Coffee Data Integration',
			ogDescription:
				'The first normalized, daily-updated API for specialty green coffee. Real-time inventory data from top U.S. suppliers.',
			ogImage: `${baseUrl}/purveyors_orange.svg`,
			ogUrl: pageUrl,
			ogType: 'product',
			twitterCard: 'summary_large_image',
			twitterTitle: 'Purveyors Green Coffee API',
			twitterDescription:
				'Integrate real-time green coffee data into your roasting software with our comprehensive REST API.',
			twitterImage: `${baseUrl}/purveyors_orange.svg`,
			schemaData
		}
	};
};
