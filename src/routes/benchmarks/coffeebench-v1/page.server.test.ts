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
					'CoffeeBench V1 finds that harnessed DeepSeek systems beat Raw, while Purveyors-specific and Parchment lift were not demonstrated.',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					description:
						'A published system benchmark with complete pairwise findings, an explicit hypothesis audit, independent rubric and operational tracks, and unsparing data limitations.',
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
