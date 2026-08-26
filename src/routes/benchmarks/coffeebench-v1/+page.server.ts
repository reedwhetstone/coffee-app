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
				'CoffeeBench V1 finds that search-equipped DeepSeek systems beat Raw in 70–75% of pairwise judgments, while no search harness separates clearly from the others.',
			keywords: ['CoffeeBench V1', 'coffee AI benchmark', 'agent benchmark', 'LLM evaluation'],
			robots: 'index, follow',
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'Dataset',
				name: 'CoffeeBench V1',
				description:
					'A published system benchmark with complete pairwise findings across four DeepSeek treatments, independent rubric and operational tracks, and explicit data limitations.',
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
