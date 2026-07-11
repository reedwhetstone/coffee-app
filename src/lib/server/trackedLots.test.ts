import { describe, it, expect, vi } from 'vitest';
import { getTrackedLotIds, getTrackedLotSummaries, toggleTrackedLot } from './trackedLots';

describe('getTrackedLotIds', () => {
	it('returns empty array when user has no tracked lots', async () => {
		const supabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockResolvedValue({ data: [], error: null })
			})
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getTrackedLotIds(supabase as any, 'user-123');
		expect(result).toEqual([]);
	});

	it('maps catalog_id values from returned rows', async () => {
		const supabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockResolvedValue({
					data: [{ catalog_id: 10 }, { catalog_id: 42 }, { catalog_id: 7 }],
					error: null
				})
			})
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getTrackedLotIds(supabase as any, 'user-123');
		expect(result).toEqual([10, 42, 7]);
	});
});

function makeSummariesSupabase(input: {
	trackedRows: Array<Record<string, unknown>>;
	catalogRows: Array<Record<string, unknown>>;
}) {
	return {
		from: vi.fn().mockImplementation((table: string) => {
			if (table === 'tracked_lots') {
				return {
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					order: vi.fn().mockReturnThis(),
					limit: vi.fn().mockResolvedValue({ data: input.trackedRows, error: null })
				};
			}
			return {
				select: vi.fn().mockReturnThis(),
				in: vi.fn().mockResolvedValue({ data: input.catalogRows, error: null })
			};
		})
	};
}

describe('getTrackedLotSummaries', () => {
	it('returns empty array without a catalog query when nothing is tracked', async () => {
		const supabase = makeSummariesSupabase({ trackedRows: [], catalogRows: [] });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getTrackedLotSummaries(supabase as any, 'user-123');
		expect(result).toEqual([]);
		expect(supabase.from).toHaveBeenCalledTimes(1);
	});

	it('joins tracked rows with live catalog state and computes the price delta', async () => {
		const supabase = makeSummariesSupabase({
			trackedRows: [
				{ catalog_id: 1, tracked_at: '2026-06-01T00:00:00Z', price_at_tracking: 6.5 },
				{ catalog_id: 2, tracked_at: '2026-05-15T00:00:00Z', price_at_tracking: null }
			],
			catalogRows: [
				{
					id: 1,
					name: 'Ethiopia Guji Natural',
					source: 'Supplier A',
					country: 'Ethiopia',
					region: 'Guji',
					processing: 'Natural',
					stocked: true,
					wholesale: false,
					unstocked_date: null,
					price_per_lb: 7.25,
					cost_lb: null
				},
				{
					id: 2,
					name: 'Colombia Huila Washed',
					source: 'Supplier B',
					country: 'Colombia',
					region: 'Huila',
					processing: 'Washed',
					stocked: false,
					wholesale: false,
					unstocked_date: '2026-06-05',
					price_per_lb: null,
					cost_lb: 5.1
				}
			]
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getTrackedLotSummaries(supabase as any, 'user-123');

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			catalogId: 1,
			name: 'Ethiopia Guji Natural',
			stocked: true,
			priceAtTracking: 6.5,
			currentPrice: 7.25,
			priceDelta: 0.75
		});
		// No price captured at tracking time → no delta claim
		expect(result[1]).toMatchObject({
			catalogId: 2,
			stocked: false,
			unstockedDate: '2026-06-05',
			priceAtTracking: null,
			currentPrice: 5.1,
			priceDelta: null
		});
	});

	it('skips tracked rows whose catalog lot no longer exists', async () => {
		const supabase = makeSummariesSupabase({
			trackedRows: [{ catalog_id: 9, tracked_at: '2026-06-01T00:00:00Z', price_at_tracking: 4 }],
			catalogRows: []
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await getTrackedLotSummaries(supabase as any, 'user-123');
		expect(result).toEqual([]);
	});

	it('throws when the tracked lots query fails', async () => {
		const supabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				order: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue({ data: null, error: new Error('rls denied') })
			})
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(getTrackedLotSummaries(supabase as any, 'user-123')).rejects.toThrow('rls denied');
	});
});

function makeToggleSupabase(input: {
	existingTrackedRow: Record<string, unknown> | null;
	catalogRow: Record<string, unknown> | null;
	insertResult?: { data: Record<string, unknown> | null; error: Error | null };
	deleteError?: Error | null;
}) {
	const insertMock = vi.fn().mockReturnValue({
		select: vi.fn().mockReturnThis(),
		single: vi
			.fn()
			.mockResolvedValue(
				input.insertResult ?? { data: { tracked_at: '2026-06-09T00:00:00Z' }, error: null }
			)
	});
	let deleteEqCount = 0;
	const deleteChain = {
		eq: vi.fn().mockImplementation(() => {
			deleteEqCount++;
			if (deleteEqCount >= 2) return Promise.resolve({ error: input.deleteError ?? null });
			return deleteChain;
		})
	};
	const from = vi.fn().mockImplementation((table: string) => {
		if (table === 'tracked_lots') {
			return {
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				maybeSingle: vi.fn().mockResolvedValue({ data: input.existingTrackedRow, error: null }),
				insert: insertMock,
				delete: vi.fn().mockReturnValue(deleteChain)
			};
		}
		return {
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: input.catalogRow, error: null })
		};
	});
	return { from, insertMock };
}

describe('toggleTrackedLot', () => {
	it('inserts a new row capturing price_at_tracking and returns tracked: true', async () => {
		const { from, insertMock } = makeToggleSupabase({
			existingTrackedRow: null,
			catalogRow: { price_per_lb: 6.8, cost_lb: 5.9 }
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await toggleTrackedLot({ from } as any, 'user-123', 99);
		expect(result.tracked).toBe(true);
		expect(result.trackedAt).toBe('2026-06-09T00:00:00Z');
		expect(insertMock).toHaveBeenCalledWith({
			user_id: 'user-123',
			catalog_id: 99,
			price_at_tracking: 6.8
		});
	});

	it('falls back to cost_lb and then null when display price evidence is missing', async () => {
		const { from, insertMock } = makeToggleSupabase({
			existingTrackedRow: null,
			catalogRow: { price_per_lb: null, cost_lb: 5.9 }
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await toggleTrackedLot({ from } as any, 'user-123', 99);
		expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ price_at_tracking: 5.9 }));

		const missing = makeToggleSupabase({ existingTrackedRow: null, catalogRow: null });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await toggleTrackedLot({ from: missing.from } as any, 'user-123', 99);
		expect(missing.insertMock).toHaveBeenCalledWith(
			expect.objectContaining({ price_at_tracking: null })
		);
	});

	it('deletes the existing row and returns tracked: false when lot is already tracked', async () => {
		const { from } = makeToggleSupabase({
			existingTrackedRow: { id: 'row-id' },
			catalogRow: null
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await toggleTrackedLot({ from } as any, 'user-123', 99);
		expect(result.tracked).toBe(false);
		expect(result.trackedAt).toBeUndefined();
	});

	it('throws when insert fails instead of falsely returning tracked: true', async () => {
		const { from } = makeToggleSupabase({
			existingTrackedRow: null,
			catalogRow: { price_per_lb: 6 },
			insertResult: { data: null, error: new Error('rls denied') }
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(toggleTrackedLot({ from } as any, 'user-123', 99)).rejects.toThrow('rls denied');
	});

	it('throws when delete fails instead of falsely returning tracked: false', async () => {
		const { from } = makeToggleSupabase({
			existingTrackedRow: { id: 'row-id' },
			catalogRow: null,
			deleteError: new Error('delete failed')
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(toggleTrackedLot({ from } as any, 'user-123', 99)).rejects.toThrow(
			'delete failed'
		);
	});
});
