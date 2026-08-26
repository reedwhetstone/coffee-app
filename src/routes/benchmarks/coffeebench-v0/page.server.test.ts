import { describe, expect, it } from 'vitest';
import { COFFEEBENCH_RESULT_PATH, COFFEEBENCH_SCHEMA_VERSION } from '$lib/benchmarks/coffeebench';
import { load } from './+page.server';

describe('CoffeeBench v0 page loader', () => {
	it('validates and returns the static versioned public artifact', async () => {
		const result = await load({
			url: new URL('https://www.purveyors.io/benchmarks/coffeebench-v0')
		} as never);

		expect(result).toMatchObject({
			benchmark: {
				schema_version: COFFEEBENCH_SCHEMA_VERSION,
				benchmark: { name: 'CoffeeBench' }
			},
			meta: {
				canonical: 'https://www.purveyors.io/benchmarks/coffeebench-v0',
				description:
					'CoffeeBench three-family agent-jury preview: Purveyors Search ranked first in pairwise quality while operational and rubric evidence remain separate. Human agreement was not measured.',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					description:
						'An uncalibrated three-family agent-jury preview with independent pairwise-quality, absolute-rubric, and operational-reliability tracks. Human agreement was not measured.',
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
