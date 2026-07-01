import { describe, expect, it, vi } from 'vitest';
import { MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';
import type { CoffeeCatalog } from '$lib/types/component.types';
import { loadBeanPickerCatalog } from './catalogPicker';

function catalogRow(id: number): CoffeeCatalog {
	return { id, name: `Coffee ${id}` } as CoffeeCatalog;
}

describe('loadBeanPickerCatalog', () => {
	it('pages through /api/catalog until pagination.hasNext is false', async () => {
		const fetchCatalog = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					data: [catalogRow(1), catalogRow(2)],
					pagination: { page: 1, limit: MAX_CATALOG_PAGE_LIMIT, total: 3, hasNext: true }
				})
			)
			.mockResolvedValueOnce(
				Response.json({
					data: [catalogRow(3)],
					pagination: { page: 2, limit: MAX_CATALOG_PAGE_LIMIT, total: 3, hasNext: false }
				})
			);

		await expect(loadBeanPickerCatalog(fetchCatalog)).resolves.toEqual([
			catalogRow(1),
			catalogRow(2),
			catalogRow(3)
		]);
		expect(fetchCatalog).toHaveBeenNthCalledWith(
			1,
			`/api/catalog?page=1&limit=${MAX_CATALOG_PAGE_LIMIT}`
		);
		expect(fetchCatalog).toHaveBeenNthCalledWith(
			2,
			`/api/catalog?page=2&limit=${MAX_CATALOG_PAGE_LIMIT}`
		);
	});

	it('keeps compatibility with the old bare-array response shape', async () => {
		const fetchCatalog = vi.fn().mockResolvedValue(Response.json([catalogRow(4)]));

		await expect(loadBeanPickerCatalog(fetchCatalog)).resolves.toEqual([catalogRow(4)]);
		expect(fetchCatalog).toHaveBeenCalledTimes(1);
	});

	it('throws when a catalog page fails', async () => {
		const fetchCatalog = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

		await expect(loadBeanPickerCatalog(fetchCatalog)).rejects.toThrow(
			'Failed to fetch catalog data'
		);
	});
});
