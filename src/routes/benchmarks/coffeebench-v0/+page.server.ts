import type { PageServerLoad } from './$types';
import { coffeeBenchV0 } from '$lib/server/benchmarks/coffeebench';
import { COFFEEBENCH_RESULT_PATH } from '$lib/benchmarks/coffeebench';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	const isFixture = coffeeBenchV0.status === 'fixture';
	return {
		benchmark: coffeeBenchV0,
		meta: buildPublicMeta({
			baseUrl,
			path: '/benchmarks/coffeebench-v0',
			title: 'CoffeeBench v0 | Purveyors',
			description: isFixture
				? 'Contract preview for CoffeeBench, a matched evaluation of whether harnesses and evidence tools improve coffee decisions. No measured result is published yet.'
				: 'Matched evaluation of whether model harnesses and evidence tools improve defensible coffee decisions after cost, latency, and failure are considered.',
			keywords: ['CoffeeBench v0', 'coffee AI benchmark', 'agent benchmark', 'LLM evaluation'],
			robots: isFixture ? 'noindex, follow' : 'index, follow',
			schemaData: isFixture
				? undefined
				: {
						'@context': 'https://schema.org',
						'@type': 'Dataset',
						name: 'CoffeeBench v0',
						description:
							'A versioned benchmark artifact for coffee supply-chain intelligence model and system tracks.',
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
