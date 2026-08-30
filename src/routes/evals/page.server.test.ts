import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('Cherry Evals index loader', () => {
	it('derives public copy inputs from the shared CoffeeBench artifact', async () => {
		const result = (await load({
			url: new URL('https://www.purveyors.io/evals')
		} as never)) as {
			benchmark: { status: string; caseCount: number; subjectTrialCount: number };
			meta: {
				canonical: string;
				title: string;
				description: string;
				keywords: string;
				schemaData: { '@type': string; name: string; description: string; url: string };
			};
		};

		expect(result.benchmark).toEqual({
			status: 'published',
			caseCount: 20,
			subjectTrialCount: 400
		});
		expect(result.meta).toMatchObject({
			canonical: 'https://www.purveyors.io/evals',
			title: 'Cherry Evals | Purveyors',
			description: 'Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.',
			keywords: expect.stringContaining('PV-Microlot'),
			schemaData: {
				'@type': 'CollectionPage',
				name: 'Cherry Evals',
				description:
					'Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.',
				url: 'https://www.purveyors.io/evals'
			}
		});
	});
});
