import type { PageServerLoad } from './$types';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	return {
		meta: buildPublicMeta({
			baseUrl,
			path: '/benchmarks',
			title: 'Coffee Intelligence Benchmarks | Purveyors',
			description:
				'Public, versioned evaluations of model and agent-system performance on coffee intelligence tasks.',
			keywords: ['coffee benchmark', 'AI evaluation', 'coffee intelligence', 'CoffeeBench'],
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: 'Purveyors Benchmarks',
				description:
					'Versioned benchmark reports for model and agent-system coffee intelligence performance.',
				url: `${baseUrl}/benchmarks`
			}
		})
	};
};
