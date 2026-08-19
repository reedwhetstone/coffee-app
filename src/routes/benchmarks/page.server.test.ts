import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('Benchmark index loader', () => {
	it('derives public copy inputs from the shared CoffeeBench artifact', async () => {
		const result = (await load({
			url: new URL('https://www.purveyors.io/benchmarks')
		} as never)) as { benchmark: { status: string; caseCount: number; subjectTrialCount: number } };

		expect(result.benchmark).toEqual({
			status: 'preview',
			caseCount: 20,
			subjectTrialCount: 400
		});
	});
});
