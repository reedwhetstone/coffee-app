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
					'Uncalibrated single-judge CoffeeBench preview; quality scores are unavailable because all treatments exceeded the predeclared 10% terminal-failure eligibility ceiling.',
				robots: 'index, follow',
				schemaData: {
					'@type': 'Dataset',
					description:
						'An uncalibrated single-judge preview of reliability and operational evidence; Bradley-Terry quality scores are unavailable because every treatment exceeded the predeclared terminal-failure eligibility ceiling.',
					distribution: {
						contentUrl: `https://www.purveyors.io${COFFEEBENCH_RESULT_PATH}`
					}
				}
			}
		});
	});
});
