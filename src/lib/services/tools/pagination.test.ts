import { describe, expect, it, vi } from 'vitest';
import { collectOffsetPages } from './pagination';
describe('offset pagination termination', () => {
	it('stops on a short page when the effective session limit is known', async () => {
		const fetchPage = vi.fn().mockResolvedValue([{ id: 1 }]);
		expect(
			await collectOffsetPages({ fetchPage, pageSize: 200, key: (row: { id: number }) => row.id })
		).toEqual([{ id: 1 }]);
		expect(fetchPage).toHaveBeenCalledOnce();
	});
	it('continues after a full page and includes the last partial page', async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
			.mockResolvedValueOnce([{ id: 3 }]);
		expect(
			await collectOffsetPages({ fetchPage, pageSize: 2, key: (row: { id: number }) => row.id })
		).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(fetchPage.mock.calls).toEqual([[0], [2]]);
	});
	it('does not infer completion from a short API-key-capped page', async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce([{ id: 1 }])
			.mockResolvedValueOnce([{ id: 2 }])
			.mockResolvedValueOnce([]);
		expect(await collectOffsetPages({ fetchPage, key: (row: { id: number }) => row.id })).toEqual([
			{ id: 1 },
			{ id: 2 }
		]);
		expect(fetchPage).toHaveBeenCalledTimes(3);
	});
	it('still rejects repeating full pages', async () => {
		const fetchPage = vi.fn().mockResolvedValue([{ id: 1 }]);
		await expect(
			collectOffsetPages({ fetchPage, pageSize: 1, key: (row: { id: number }) => row.id })
		).rejects.toThrow('no progress');
	});
});
