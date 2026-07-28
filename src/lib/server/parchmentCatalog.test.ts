import { describe, expect, it, vi } from 'vitest';
import { fetchParchmentCatalogItemsByIds } from './parchmentCatalog';

describe('fetchParchmentCatalogItemsByIds', () => {
	it('splits catalog hydration into requests at the API page-size ceiling', async () => {
		const ids = Array.from({ length: 1001 }, (_, index) => index + 1);
		const list = vi
			.fn()
			.mockImplementation(async (query: { coffeeIds: string; limit: number }) => ({
				data: {
					data: query.coffeeIds.split(',').map((id) => ({ id: Number(id) }))
				}
			}));

		const rows = await fetchParchmentCatalogItemsByIds({ catalog: { list } } as never, ids);

		expect(list).toHaveBeenCalledTimes(2);
		expect(list).toHaveBeenNthCalledWith(1, {
			coffeeIds: ids.slice(0, 1000).join(','),
			stocked: 'all',
			showWholesale: 'true',
			limit: 1000
		});
		expect(list).toHaveBeenNthCalledWith(2, {
			coffeeIds: '1001',
			stocked: 'all',
			showWholesale: 'true',
			limit: 1
		});
		expect(rows).toHaveLength(1001);
		expect(rows.at(-1)).toEqual({ id: 1001 });
	});
});
