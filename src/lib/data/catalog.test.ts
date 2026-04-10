import { describe, expect, it, vi } from 'vitest';
import { searchCatalog } from './catalog';

function createSupabaseMock() {
	const result = {
		data: [],
		count: 0,
		error: null
	};

	const state = {
		gteCalls: [] as Array<[string, unknown]>,
		eqCalls: [] as Array<[string, unknown]>,
		orderCalls: [] as Array<[string, { ascending: boolean }]>
	};

	const builder = {
		select: vi.fn(() => builder),
		eq: vi.fn((column: string, value: unknown) => {
			state.eqCalls.push([column, value]);
			return builder;
		}),
		gte: vi.fn((column: string, value: unknown) => {
			state.gteCalls.push([column, value]);
			return builder;
		}),
		lte: vi.fn(() => builder),
		ilike: vi.fn(() => builder),
		in: vi.fn(() => builder),
		or: vi.fn(() => builder),
		order: vi.fn((column: string, options: { ascending: boolean }) => {
			state.orderCalls.push([column, options]);
			return builder;
		}),
		range: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		then: (
			onFulfilled?: (value: typeof result) => unknown,
			onRejected?: (reason: unknown) => unknown
		) => Promise.resolve(result).then(onFulfilled, onRejected)
	};

	const supabase = {
		from: vi.fn(() => builder)
	};

	return { supabase, state };
}

describe('searchCatalog stocked date filters', () => {
	it('treats stockedDate as an absolute lower-bound date filter', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { stockedDate: '2026-03-01' });

		expect(state.gteCalls).toEqual([['stocked_date', '2026-03-01']]);
	});

	it('keeps relative stockedDays filtering behind stockedDays', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { stockedDays: 30 });

		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - 30);

		expect(state.gteCalls).toEqual([['stocked_date', cutoff.toISOString().split('T')[0]]]);
	});
});
