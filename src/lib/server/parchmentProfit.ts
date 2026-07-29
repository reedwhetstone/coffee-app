import type { ParchmentClient, ProfitItem } from '@purveyors/sdk';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

export type ParchmentProfitProjection = Omit<ProfitItem, 'coffee_name' | 'purchase_date'> & {
	coffee_name: string | undefined;
	purchase_date: string | undefined;
};

const PAGE_LIMIT = 200;

function projectProfitItem(item: ProfitItem): ParchmentProfitProjection {
	return {
		...item,
		coffee_name: item.coffee_name ?? undefined,
		purchase_date: item.purchase_date ?? undefined
	};
}

/**
 * List every owner-scoped profit summary through Parchment while preserving
 * the legacy `/api/profit` projection. Legacy JSON omitted absent coffee names
 * and purchase dates, whereas the canonical SDK resource represents them as
 * null.
 */
export async function fetchParchmentProfit(
	client: ParchmentClient
): Promise<ParchmentProfitProjection[]> {
	const items = await collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(await client.profit.list({ limit: PAGE_LIMIT, offset })).data,
		key: (row) => row.id
	});

	return items.map(projectProfitItem);
}
