import type { PageServerLoad } from './$types';
import { coffeeBenchV0 } from '$lib/server/benchmarks/coffeebench';
import { COFFEEBENCH_RESULT_PATH } from '$lib/benchmarks/coffeebench';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	return {
		benchmark: coffeeBenchV0,
		meta: buildPublicMeta({
			baseUrl,
			path: '/benchmarks/coffeebench-v0',
			title: 'CoffeeBench v0 | Purveyors',
			description:
				'CoffeeBench three-family agent-jury preview: Purveyors Search ranked first in pairwise quality while operational and rubric evidence remain separate. Human agreement was not measured.',
			keywords: ['CoffeeBench v0', 'coffee AI benchmark', 'agent benchmark', 'LLM evaluation'],
			robots: 'index, follow',
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'Dataset',
				name: 'CoffeeBench v0',
				description:
					'An uncalibrated three-family agent-jury preview with independent pairwise-quality, absolute-rubric, and operational-reliability tracks. Human agreement was not measured.',
				url: `${baseUrl}/benchmarks/coffeebench-v0`,
				distribution: {
					'@type': 'DataDownload',
					encodingFormat: 'application/json',
					contentUrl: `${baseUrl}${COFFEEBENCH_RESULT_PATH}`
				}
			}
		})
	};
};
