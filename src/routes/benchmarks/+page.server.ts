import type { PageServerLoad } from './$types';
import { coffeeBenchV1 } from '$lib/server/benchmarks/coffeebench';
import { PV_MICROLOT_FULL_NAME, PV_MICROLOT_NAME } from '$lib/benchmarks/marketing';
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
			path: '/benchmarks',
			title: 'Coffee Intelligence Benchmarks | Purveyors',
			description:
				'Public, versioned evaluations of model and agent-system performance on coffee intelligence tasks.',
			keywords: ['coffee benchmark', 'AI evaluation', 'coffee intelligence', PV_MICROLOT_NAME],
			schemaData: {
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: 'Purveyors Benchmarks',
				description: `Versioned benchmark reports for model and agent-system coffee intelligence performance, including ${PV_MICROLOT_FULL_NAME}.`,
				url: `${baseUrl}/benchmarks`
			}
		})
	};
};
