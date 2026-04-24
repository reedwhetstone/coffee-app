import { describe, expect, it, vi } from 'vitest';
import { getCatalogDropdown, searchCatalog, searchCatalogDropdown } from './catalog';

function createSupabaseMock() {
	const result = {
		data: [],
		count: 0,
		error: null as unknown
	};
	const results: Array<typeof result> = [];

	const state = {
		selectCalls: [] as Array<[string, unknown?]>,
		gteCalls: [] as Array<[string, unknown]>,
		lteCalls: [] as Array<[string, unknown]>,
		eqCalls: [] as Array<[string, unknown]>,
		ilikeCalls: [] as Array<[string, string]>,
		inCalls: [] as Array<[string, unknown[]]>,
		containsCalls: [] as Array<[string, unknown[]]>,
		overlapsCalls: [] as Array<[string, unknown[]]>,
		containedByCalls: [] as Array<[string, unknown[]]>,
		orCalls: [] as string[],
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
		lte: vi.fn((column: string, value: unknown) => {
			state.lteCalls.push([column, value]);
			return builder;
		}),
		ilike: vi.fn((column: string, value: string) => {
			state.ilikeCalls.push([column, value]);
			return builder;
		}),
		in: vi.fn((column: string, value: unknown[]) => {
			state.inCalls.push([column, value]);
			return builder;
		}),
		contains: vi.fn((column: string, value: unknown[]) => {
			state.containsCalls.push([column, value]);
			return builder;
		}),
		overlaps: vi.fn((column: string, value: unknown[]) => {
			state.overlapsCalls.push([column, value]);
			return builder;
		}),
		containedBy: vi.fn((column: string, value: unknown[]) => {
			state.containedByCalls.push([column, value]);
			return builder;
		}),
		or: vi.fn((value: string) => {
			state.orCalls.push(value);
			return builder;
		}),
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
		) => Promise.resolve(results.shift() ?? result).then(onFulfilled, onRejected)
	};

	const supabase = {
		from: vi.fn(() => builder)
	};

	return {
		supabase,
		state,
		queueResult: (next: typeof result) => results.push(next)
	};
}

describe('searchCatalog stocked date filters', () => {
	it('treats stockedDate as an absolute lower-bound date filter', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { stockedDate: '2026-03-01' });

		expect(state.gteCalls).toEqual([['stocked_date', '2026-03-01']]);
	});

	it('uses the resource projection without selecting raw processing evidence blobs', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { fields: 'resource' });

		const [columns] = state.selectCalls[0];
		expect(columns).toContain(
			'processing_evidence_schema_version:processing_evidence->>schema_version'
		);
		expect(columns).not.toBe('*');
		expect(columns).not.toMatch(/(^|, )processing_evidence(,|$)/);
	});

	it('falls back to the full projection when the resource projection is ahead of the database schema', async () => {
		const { supabase, state, queueResult } = createSupabaseMock();

		// Simulate a preview/test database that has not run the processing transparency
		// migration yet. The first resource projection should not make catalog reads fail.
		queueResult({ data: [], count: 0, error: { code: '42703' } });
		queueResult({ data: [], count: 0, error: null });

		await searchCatalog(supabase as never, { fields: 'resource' });

		expect(state.selectCalls.at(-2)?.[0]).toContain(
			'processing_evidence_schema_version:processing_evidence->>schema_version'
		);
		expect(state.selectCalls.at(-1)).toEqual(['*', undefined]);
	});

	it('keeps relative stockedDays filtering behind stockedDays', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { stockedDays: 30 });

		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - 30);

		expect(state.gteCalls).toEqual([['stocked_date', cutoff.toISOString().split('T')[0]]]);
	});
});

describe('searchCatalog processing transparency filters', () => {
	it('applies structured process filters without replacing legacy processing search', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, {
			processing: 'Anaerobic',
			processingBaseMethod: 'Natural',
			fermentationType: 'Anaerobic',
			processAdditive: 'hops',
			processingDisclosureLevel: 'high_detail',
			processingConfidenceMin: 0.8
		});

		expect(state.ilikeCalls).toContainEqual(['processing', '%Anaerobic%']);
		expect(state.eqCalls).toEqual([
			['processing_base_method', 'Natural'],
			['fermentation_type', 'Anaerobic'],
			['processing_disclosure_level', 'high_detail']
		]);
		expect(state.containsCalls).toEqual([['process_additives', ['hops']]]);
		expect(state.gteCalls).toEqual([['processing_confidence', 0.8]]);
	});

	it('treats hasAdditives=false as explicit none, not unknown metadata', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { hasAdditives: false });

		expect(state.containsCalls).toEqual([['process_additives', ['none']]]);
		expect(state.containedByCalls).toEqual([['process_additives', ['none']]]);
		expect(state.overlapsCalls).toEqual([]);
	});

	it('filters hasAdditives=true to disclosed additive values', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalog(supabase as never, { hasAdditives: true });

		expect(state.overlapsCalls).toEqual([
			[
				'process_additives',
				['fruit', 'yeast', 'hops', 'spice', 'botanical', 'mossto', 'starter-culture', 'other']
			]
		]);
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

	it('applies canonical filters and sorting for paginated dropdown queries', async () => {
		const { supabase, state } = createSupabaseMock();

		await searchCatalogDropdown(supabase as never, {
			origin: 'Africa',
			country: ['Ethiopia', 'Kenya'],
			source: ['sweet_maria'],
			name: 'Sidamo',
			processing: 'Washed',
			pricePerLbMin: 7.25,
			scoreValueMax: 88,
			orderBy: 'name',
			orderDirection: 'asc',
			limit: 10,
			offset: 10
		});

		expect(state.orCalls).toEqual([
			'continent.ilike.%Africa%,country.ilike.%Africa%,region.ilike.%Africa%'
		]);
		expect(state.inCalls).toEqual([
			['country', ['Ethiopia', 'Kenya']],
			['source', ['sweet_maria']]
		]);
		expect(state.ilikeCalls).toEqual([
			['name', '%Sidamo%'],
			['processing', '%Washed%']
		]);
		expect(state.gteCalls).toEqual([['price_per_lb', 7.25]]);
		expect(state.lteCalls).toEqual([['score_value', 88]]);
		expect(state.orderCalls).toEqual([['name', { ascending: true }]]);
		expect(state.rangeCalls).toEqual([[10, 19]]);
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
