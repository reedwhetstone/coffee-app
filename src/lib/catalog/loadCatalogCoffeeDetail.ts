import { toCatalogResourceItem } from '$lib/catalog/catalogResourceItem';
import type { CoffeeCatalog } from '$lib/types/component.types';

/** Demand-load one full, owner-entitled row; never create a shared private cache. */
export async function loadCatalogCoffeeDetail(
	id: number,
	signal: AbortSignal
): Promise<CoffeeCatalog> {
	const query = new URLSearchParams({
		coffeeIds: String(id),
		stocked: 'all',
		limit: '1',
		projection: 'full',
		include: 'proof'
	});
	const response = await fetch(`/api/catalog?${query}`, { signal });
	if (!response.ok) throw new Error('Coffee detail unavailable');
	const body = await response.json();
	const row = Array.isArray(body?.data)
		? body.data.find((item: { id?: unknown }) => item?.id === id)
		: undefined;
	if (!row || row.summarySignals) throw new Error('Full coffee detail unavailable');
	return toCatalogResourceItem(row) as unknown as CoffeeCatalog;
}
