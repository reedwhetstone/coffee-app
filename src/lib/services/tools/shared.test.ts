import { describe, expect, it, vi } from 'vitest';
import { attachRoastSummaries } from './shared';

const inventory = [
	{ id: 7, purchased_qty_lbs: 2, bean_cost: 1, tax_ship_cost: 0, stocked: true }
] as never;

describe('attachRoastSummaries pagination', () => {
	it('walks capped pages, de-duplicates overlaps, and summarizes more than 500 roasts', async () => {
		const all = Array.from({ length: 550 }, (_, index) => ({
			roast_id: index + 1,
			coffee_id: 7,
			roast_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
			oz_in: 1
		}));
		const list = vi.fn(async ({ offset }: { offset?: number }) => {
			const start = offset ?? 0;
			// Simulate a server cap of 100 and a repeated boundary row.
			const page = start === 0 ? all.slice(0, 100) : all.slice(Math.max(0, start - 1), start + 99);
			return { data: { data: page } };
		});
		const result = await attachRoastSummaries({ roasts: { list } } as never, inventory);
		expect(result[0].roast_summary.total_roasts).toBe(550);
		expect(result[0].roast_summary.total_oz_in).toBe(550);
		expect(list.mock.calls.length).toBeGreaterThan(5);
	});

	it('rejects a capped page that makes no progress instead of returning partial totals', async () => {
		const page = [{ roast_id: 1, coffee_id: 7, roast_date: null, oz_in: 1 }];
		const list = vi.fn().mockResolvedValue({ data: { data: page } });
		await expect(attachRoastSummaries({ roasts: { list } } as never, inventory)).rejects.toThrow(
			'pagination made no progress'
		);
	});
});
