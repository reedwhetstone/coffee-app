import { describe, expect, it, vi } from 'vitest';
import { getCatalogDropdown, searchCatalog, searchCatalogDropdown } from './catalog';

function createSupabaseMock() {
	const result = {
		data: [],
		count: 0,
		error: null
	};

	const state = {
		selectCalls: [] as Array<[string, unknown?]>,
		gteCalls: [] as Array<[string, unknown]>,
		eqCalls: [] as Array<[string, unknown]>,
		orderCalls: [] as Array<[string, { ascending: boolean }]>,
		rangeCalls: [] as Array<[number, number]>,
		limitCalls: [] as number[]
	};

	const builder = {
		select: vi.fn((columns: string, options?: unknown) => {
			state.selectCalls.push([columns, options]);
			return builder;
		}),
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
		range: vi.fn((from: number, to: number) => {
			state.rangeCalls.push([from, to]);
			return builder;
		}),
		limit: vi.fn((value: number) => {
			state.limitCalls.push(value);
			return builder;
		}),
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

describe('searchCatalogDropdown', () => {
	it('uses the reduced projection with exact counts for paginated dropdown queries', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalogDropdown(supabase as never, {
			stockedFilter: false,
			publicOnly: true,
			showWholesale: false,
			limit: 15,
			offset: 15
		});

		expect(state.selectCalls).toEqual([
			[
				'id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee',
				{ count: 'exact' }
			]
		]);
		expect(state.eqCalls).toEqual([
			['stocked', false],
			['public_coffee', true],
			['wholesale', false]
		]);
		expect(state.orderCalls).toEqual([['arrival_date', { ascending: false }]]);
		expect(state.rangeCalls).toEqual([[15, 29]]);
	});

	it('keeps unpaginated dropdown queries backward-compatible', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalogDropdown(supabase as never, { stockedFilter: null });

		expect(state.selectCalls).toEqual([
			['id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee', undefined]
		]);
		expect(state.eqCalls).toEqual([]);
		expect(state.rangeCalls).toEqual([]);
		expect(state.limitCalls).toEqual([]);
	});
});

describe('getCatalogDropdown', () => {
	it('remains a thin unpaginated wrapper for existing callers', async () => {
		const { supabase, state } = createSupabaseMock();

		await getCatalogDropdown(supabase as never, {
			stockedFilter: true,
			wholesaleOnly: true
		});

		expect(state.selectCalls).toEqual([
			['id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee', undefined]
		]);
		expect(state.eqCalls).toEqual([
			['stocked', true],
			['wholesale', true]
		]);
		expect(state.rangeCalls).toEqual([]);
		expect(state.limitCalls).toEqual([]);
	});
});
