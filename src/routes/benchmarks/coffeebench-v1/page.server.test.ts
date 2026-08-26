import { describe, expect, it } from 'vitest';
import { COFFEEBENCH_RESULT_PATH, COFFEEBENCH_SCHEMA_VERSION } from '$lib/benchmarks/coffeebench';
import { load } from './+page.server';

describe('CoffeeBench V1 page loader', () => {
	it('validates and returns the static versioned public artifact', async () => {
		const result = await load({
			url: new URL('https://www.purveyors.io/benchmarks/coffeebench-v1')
		} as never);

		expect(result).toMatchObject({
			benchmark: {
				schema_version: COFFEEBENCH_SCHEMA_VERSION,
				benchmark: { name: 'CoffeeBench' }
			},
			meta: {
				canonical: 'https://www.purveyors.io/benchmarks/coffeebench-v1',
				description:
					'CoffeeBench V1 finds that search-equipped DeepSeek systems beat Raw in 70–75% of pairwise judgments, while no search harness separates clearly from the others.',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					description:
						'A published system benchmark with complete pairwise findings across four DeepSeek treatments, independent rubric and operational tracks, and explicit data limitations.',
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
