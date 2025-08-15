import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url, data: serverData }) => {
	const layoutData = await parent();

	// Combine layout data with server data
	const combinedData = { ...layoutData, ...serverData };

	// Home page always returns marketing page metadata
	return {
		...combinedData,
		meta: {
			title: 'Purveyors - Master Your Coffee Roasting Journey',
			description:
				'Transform your coffee business with AI-powered recommendations, comprehensive inventory tracking, and data-driven insights. From bean selection to profit optimization.',
			keywords:
				'coffee roasting, coffee inventory, coffee business, roasting profiles, coffee analytics, coffee AI, coffee management software',
			ogTitle: 'Purveyors - Professional Coffee Roasting Platform',
			ogDescription:
				'AI-powered coffee roasting platform trusted by roasters worldwide. Track inventory, analyze roasting profiles, and optimize profits.',
			ogImage: '/og-image.jpg',
			ogUrl: url.href,
			twitterCard: 'summary_large_image',
			twitterTitle: 'Purveyors - Master Your Coffee Roasting Journey',
			twitterDescription:
				'Transform your coffee business with AI-powered recommendations and data-driven insights.',
			structuredData: {
				'@context': 'https://schema.org',
				'@type': 'SoftwareApplication',
				name: 'Purveyors',
				applicationCategory: 'BusinessApplication',
				operatingSystem: 'Web',
				description:
					'Professional coffee roasting platform with AI-powered recommendations, inventory tracking, and profit optimization.',
				offers: {
					'@type': 'Offer',
					price: '0',
					priceCurrency: 'USD',
					description: 'Free trial available'
				},
				aggregateRating: {
					'@type': 'AggregateRating',
					ratingValue: '4.8',
					ratingCount: '127'
				}
			}
		}
	};
};
