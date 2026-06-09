import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrackedLotIds, toggleTrackedLot } from './trackedLots';

function makeClient(rows: unknown[] = [], existingRow: unknown = null) {
	const chainWithRows = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockResolvedValue({ data: rows, error: null }),
		maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
		single: vi.fn().mockResolvedValue({
			data: { tracked_at: '2026-06-09T00:00:00Z' },
			error: null
		})
	};
	const deleteChain = {
		eq: vi.fn().mockReturnThis(),
		// second eq resolves
		// We chain two .eq() calls
	};
	// Make delete chain return resolved value on second .eq()
	let deleteEqCount = 0;
	deleteChain.eq.mockImplementation(() => {
		deleteEqCount++;
		if (deleteEqCount >= 2) return Promise.resolve({ error: null });
		return deleteChain;
	});

	const insertChain = {
		select: vi.fn().mockReturnThis(),
		single: vi
			.fn()
			.mockResolvedValue({ data: { tracked_at: '2026-06-09T00:00:00Z' }, error: null })
	};
	const insertBase = {
		insert: vi.fn().mockReturnValue(insertChain)
	};

	return {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		from: vi.fn((table: string) => {
			if (table === 'tracked_lots') {
				return {
					select: vi.fn().mockReturnValue(chainWithRows),
					delete: vi.fn().mockReturnValue(deleteChain),
					insert: vi.fn().mockReturnValue(insertChain),
					eq: vi.fn().mockReturnThis()
				};
			}
			return {};
		})
	};
}

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

describe('toggleTrackedLot', () => {
	it('inserts a new row and returns tracked: true when lot is not yet tracked', async () => {
		const supabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
				insert: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					single: vi.fn().mockResolvedValue({
						data: { tracked_at: '2026-06-09T00:00:00Z' },
						error: null
					})
				})
			})
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await toggleTrackedLot(supabase as any, 'user-123', 99);
		expect(result.tracked).toBe(true);
		expect(result.trackedAt).toBe('2026-06-09T00:00:00Z');
	});

	it('deletes the existing row and returns tracked: false when lot is already tracked', async () => {
		let deleteEqCount = 0;
		const deleteChain = {
			eq: vi.fn().mockImplementation(() => {
				deleteEqCount++;
				if (deleteEqCount >= 2) return Promise.resolve({ error: null });
				return deleteChain;
			})
		};
		const supabase = {
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnThis(),
				eq: vi.fn().mockReturnThis(),
				maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'row-id' }, error: null }),
				delete: vi.fn().mockReturnValue(deleteChain)
			})
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = await toggleTrackedLot(supabase as any, 'user-123', 99);
		expect(result.tracked).toBe(false);
		expect(result.trackedAt).toBeUndefined();
	});
});
