import type { PageServerLoad } from './$types';
import { coffeeBenchV1 } from '$lib/server/benchmarks/coffeebench';
import { PV_MICROLOT_NAME } from '$lib/benchmarks/marketing';
import { buildPublicMeta } from '$lib/seo/meta';

export const load: PageServerLoad = async ({ url }) => {
	const baseUrl = `${url.protocol}//${url.host}`;
	return {
		benchmark: {
			status: coffeeBenchV1.status,
			caseCount: coffeeBenchV1.methodology.case_count,
			subjectTrialCount: coffeeBenchV1.methodology.subject_trial_count
		},
		meta: buildPublicMeta({
			baseUrl,
			path: '/evals',
			title: 'Cherry Evals | Purveyors',
			description: 'Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.',
			keywords: ['coffee benchmark', 'AI evaluation', 'coffee intelligence', PV_MICROLOT_NAME],
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: 'Cherry Evals',
				description:
					'Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.',
				url: `${baseUrl}/evals`
			}
		})
	};
};
