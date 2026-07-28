import type { ParchmentClient, components } from '@purveyors/sdk';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

export type ParchmentSaleProjection = components['schemas']['SaleResource'];

const PAGE_LIMIT = 200;

/**
 * List every owner-scoped sale through Parchment while preserving the legacy
 * `/api/profit` sales row shape.
 */
export function fetchParchmentSales(client: ParchmentClient): Promise<ParchmentSaleProjection[]> {
	return collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(await client.sales.list({ limit: PAGE_LIMIT, offset })).data,
		key: (row) => row.id
	});
}
