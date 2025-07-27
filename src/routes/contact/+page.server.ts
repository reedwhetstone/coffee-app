import type { PageServerLoad } from './$types';
import { createSchemaService } from '$lib/services/schemaService';
import { generateBreadcrumbs } from '$lib/utils/breadcrumbs';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const pageUrl = `${baseUrl}/contact`;
	const schemaService = createSchemaService(baseUrl);
	const breadcrumbs = generateBreadcrumbs(url.pathname, baseUrl);

	// Organization information for AboutPage schema
	const organizationData = {
		name: 'Purveyors',
		description: 'Open source coffee platform built to democratize coffee sourcing and make roast management more accessible for hobbyist & SMB roasters.',
		founder: 'Reed Whetstone',
		foundingDate: '2024',
		mission: 'Democratizing Coffee. Making specialty coffee sourcing and roast management more accessible through open source tools and normalized data.'
	};

	// Founder information for Person schema  
	const founderData = {
		name: 'Reed Whetstone',
		jobTitle: 'Founder & Coffee Enthusiast',
		description: 'Coffee lover, home roaster, and creator of Purveyors. With a background in engineering, product, and analytics, Reed built this platform to make sourcing incredible green coffee easier, smarter, and more fun.',
		organization: 'Purveyors',
		email: 'hello@purveyors.io',
		image: `${baseUrl}/founder.JPG`,
		url: pageUrl,
		expertise: [
			'Coffee & Roasting',
			'Green Coffee Sourcing', 
			'Product Strategy',
			'Data & Analytics',
			'Software & Systems Design',
			'UX for Tools & Platforms',
			'Operations & Process Optimization',
			'Coffee Tech & Tooling',
			'AI-Enhanced Workflows'
		]
	};

	// Generate about page schema with organization and founder data
	const schemaData = schemaService.generatePageSchema('about', pageUrl, {
		organization: organizationData,
		founder: founderData,
		breadcrumbs
	});

	return {
		meta: {
			title: 'About Purveyors - Meet the Team & Open Source Coffee Project',
			description: 'Learn about Purveyors, our open source coffee platform, and meet founder Reed Whetstone. Get in touch with questions about our coffee roasting tools and green coffee API.',
			keywords: 'about purveyors, reed whetstone, coffee platform founder, open source coffee, green coffee API creator, coffee roasting tools',
			canonical: pageUrl,
			ogTitle: 'About Purveyors - Open Source Coffee Platform',
			ogDescription: 'Meet the team behind Purveyors and learn about our mission to democratize coffee sourcing through open source tools.',
			ogImage: `${baseUrl}/founder.JPG`,
			ogUrl: pageUrl,
			ogType: 'profile',
			twitterCard: 'summary_large_image',
			twitterTitle: 'About Purveyors - Reed Whetstone, Founder',
			twitterDescription: 'Meet the founder of Purveyors and learn about our open source coffee platform.',
			twitterImage: `${baseUrl}/founder.JPG`,
			schemaData
		}
	};
};