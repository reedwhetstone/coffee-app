import { describe, it, expect, vi } from 'vitest';
import { getBriefMatchSummaries, type MatchableLot } from './briefMatchSummary';

const lots: MatchableLot[] = [
	{ id: 1, country: 'Ethiopia', region: 'Yirgacheffe', processing: 'Washed', price_per_lb: 5.5, stocked: true, wholesale: false },
	{ id: 2, country: 'Colombia', region: 'Huila', processing: 'Natural', price_per_lb: 6.0, stocked: true, wholesale: false },
	{ id: 3, country: 'Ethiopia', region: 'Sidamo', processing: 'Natural', price_per_lb: 7.0, stocked: true, wholesale: false },
	{ id: 4, country: 'Peru', region: null, processing: 'Washed', price_per_lb: null, stocked: true, wholesale: false }
];

function makeSupabase(briefs: unknown[]) {
	return {
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue({ data: briefs, error: null })
		})
	};
}

describe('getBriefMatchSummaries', () => {
	it('returns empty array when user has no active briefs', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase([]) as any, 'user-1', lots);
		expect(result).toEqual([]);
	});

	it('returns empty array when catalog is empty', async () => {
		const briefs = [{ id: 'b1', name: 'Ethiopia brief', criteria: { version: 1, country: 'Ethiopia' } }];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', []);
		expect(result).toEqual([]);
	});

	it('matches lots by country criteria', async () => {
		const briefs = [{ id: 'b1', name: 'Ethiopia brief', criteria: { version: 1, country: 'Ethiopia' } }];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', lots);
		expect(result).toHaveLength(1);
		expect(result[0].briefName).toBe('Ethiopia brief');
		expect(result[0].matchCount).toBe(2);
		expect(result[0].matchingIds).toContain(1);
		expect(result[0].matchingIds).toContain(3);
	});

	it('filters by max_price_per_lb, excluding null-priced lots', async () => {
		const briefs = [{ id: 'b2', name: 'Budget brief', criteria: { version: 1, max_price_per_lb: 6.0 } }];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', lots);
		expect(result[0].matchingIds).toContain(1); // $5.50
		expect(result[0].matchingIds).toContain(2); // $6.00
		expect(result[0].matchingIds).not.toContain(3); // $7.00
		expect(result[0].matchingIds).not.toContain(4); // null price excluded
	});

	it('excludes briefs with zero matches from result', async () => {
		const briefs = [
			{ id: 'b1', name: 'Kenya brief', criteria: { version: 1, country: 'Kenya' } },
			{ id: 'b2', name: 'Ethiopia brief', criteria: { version: 1, country: 'Ethiopia' } }
		];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', lots);
		expect(result).toHaveLength(1);
		expect(result[0].briefName).toBe('Ethiopia brief');
	});

	it('skips briefs with invalid criteria without throwing', async () => {
		const briefs = [
			{ id: 'b1', name: 'Bad brief', criteria: { version: 1, unsupported_field: 'x' } },
			{ id: 'b2', name: 'Good brief', criteria: { version: 1, country: 'Colombia' } }
		];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', lots);
		expect(result).toHaveLength(1);
		expect(result[0].briefName).toBe('Good brief');
	});

	it('returns criteria object on each match summary', async () => {
		const briefs = [{ id: 'b1', name: 'Washed brief', criteria: { version: 1, processing: 'Washed' } }];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getBriefMatchSummaries(makeSupabase(briefs) as any, 'user-1', lots);
		expect(result[0].criteria).toMatchObject({ processing: 'Washed' });
	});
});
