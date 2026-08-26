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
					'CoffeeBench V1 finds that agent harnesses improve coffee research, while specialist tools need relevance-aware exposure.',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					description:
						'A 20-case coffee research benchmark comparing one fixed model across raw, general-agent, domain-agent, and catalog-augmented systems.',
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
