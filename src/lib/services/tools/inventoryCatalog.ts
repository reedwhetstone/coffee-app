import type { components } from '@purveyors/sdk';
import type { AgentParchmentClient } from './parchment';
import { unwrapParchment } from './parchment';

const CATALOG_PAGE_SIZE = 500;

export interface InventoryActionCatalogResult {
	items: components['schemas']['CatalogItem'][];
	complete: boolean;
}

type CatalogItem = components['schemas']['CatalogItem'];

/**
 * Load the complete stocked catalog for the add-inventory action card.
 *
 * `searchCatalog` returns one offset/limit page. The action card needs the same
 * complete supplier/coffee universe as the standard bean picker, otherwise a
 * supplier selected in the card only sees whichever rows happened to land in
 * the first global sample.
 */
export async function loadInventoryActionCatalog(
	client: AgentParchmentClient,
	requestedCatalogId?: number
): Promise<InventoryActionCatalogResult> {
	const byId = new Map<number, CatalogItem>();
	let offset = 0;
	let complete = true;

	while (true) {
		let page: CatalogItem[];
		try {
			page = unwrapParchment(
				await client.catalog.list({
					stocked: 'true',
					sort: 'name',
					page: Math.floor(offset / CATALOG_PAGE_SIZE) + 1,
					limit: CATALOG_PAGE_SIZE
				})
			).data;
		} catch (error) {
			if (byId.size === 0) throw error;
			complete = false;
			break;
		}

		const before = byId.size;
		for (const item of page) byId.set(item.id, item);
		if (page.length < CATALOG_PAGE_SIZE) break;
		if (byId.size === before) {
			complete = false;
			break;
		}
		offset += CATALOG_PAGE_SIZE;
	}

	if (requestedCatalogId && !byId.has(requestedCatalogId)) {
		try {
			const requested = unwrapParchment(
				await client.catalog.list({
					coffeeIds: String(requestedCatalogId),
					limit: 1
				})
			).data;
			for (const item of requested) byId.set(item.id, item);
		} catch {
			complete = false;
		}
	}

	return { items: [...byId.values()], complete };
}
