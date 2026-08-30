import { describe, expect, it } from 'vitest';
import { COFFEEBENCH_RESULT_PATH, COFFEEBENCH_SCHEMA_VERSION } from '$lib/benchmarks/coffeebench';
import { load } from './+page.server';

describe('CoffeeBench V1 page loader', () => {
	it('validates and returns the static versioned public artifact', async () => {
		const result = await load({
			url: new URL('https://www.purveyors.io/evals/coffeebench-v1')
		} as never);

		expect(result).toMatchObject({
			benchmark: {
				schema_version: COFFEEBENCH_SCHEMA_VERSION,
				benchmark: { name: 'CoffeeBench' }
			},
			meta: {
				canonical: 'https://www.purveyors.io/evals/coffeebench-v1',
				title: 'PV-Microlot V1 findings | Cherry Evals',
				description:
					'PV-Microlot V1, Purveyors’ agentic coffee specialist benchmark, finds that agent harnesses improve coffee research while specialist tools need relevance-aware exposure.',
				keywords: 'PV-Microlot, coffee AI benchmark, agent benchmark, LLM evaluation',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					name: 'PV-Microlot: Agentic Coffee Specialist Benchmark V1',
					description:
						'A 20-case coffee research benchmark comparing one fixed model across raw, general-agent, domain-agent, and catalog-augmented systems.',
					isPartOf: {
						'@type': 'CollectionPage',
						name: 'Cherry Evals',
						url: 'https://www.purveyors.io/evals'
					},
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
