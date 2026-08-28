import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('Benchmark index loader', () => {
	it('derives public copy inputs from the shared CoffeeBench artifact', async () => {
		const result = await load({
			url: new URL('https://www.purveyors.io/benchmarks')
		} as never);

		expect(result.benchmark).toEqual({
			status: 'published',
			caseCount: 20,
			subjectTrialCount: 400
		});
		expect(result.meta).toMatchObject({
			keywords: expect.stringContaining('PV-Microlot'),
			schemaData: {
				'@type': 'CollectionPage',
				description: expect.stringContaining('PV-Microlot: Agentic Coffee Specialist Benchmark')
			}
		});
	});
});
