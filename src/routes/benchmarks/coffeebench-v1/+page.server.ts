import type { PageServerLoad } from './$types';
import { coffeeBenchV1 } from '$lib/server/benchmarks/coffeebench';
import { COFFEEBENCH_RESULT_PATH } from '$lib/benchmarks/coffeebench';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	return {
		benchmark: coffeeBenchV1,
		meta: buildPublicMeta({
			baseUrl,
			path: '/benchmarks/coffeebench-v1',
			title: 'CoffeeBench V1 findings | Purveyors',
			description:
				'CoffeeBench V1 finds that agent harnesses improve coffee research, while specialist tools need relevance-aware exposure.',
			keywords: ['CoffeeBench V1', 'coffee AI benchmark', 'agent benchmark', 'LLM evaluation'],
			robots: 'index, follow',
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'Dataset',
				name: 'CoffeeBench V1',
				description:
					'A 20-case coffee research benchmark comparing one fixed model across raw, general-agent, domain-agent, and catalog-augmented systems.',
				url: `${baseUrl}/benchmarks/coffeebench-v1`,
				distribution: {
					'@type': 'DataDownload',
					encodingFormat: 'application/json',
					contentUrl: `${baseUrl}${COFFEEBENCH_RESULT_PATH}`
				}
			}
		})
	};
};
