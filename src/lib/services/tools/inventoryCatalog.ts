import { searchCatalog, type CatalogItem, type SearchCatalogInput } from '@purveyors/cli/catalog';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_PAGE_SIZE = 500;

export interface InventoryActionCatalogResult {
	items: CatalogItem[];
	complete: boolean;
}

type CatalogSearch = (
	supabase: SupabaseClient,
	input: SearchCatalogInput
) => Promise<CatalogItem[]>;

/**
 * Load the complete stocked catalog for the add-inventory action card.
 *
 * `searchCatalog` returns one offset/limit page. The action card needs the same
 * complete supplier/coffee universe as the standard bean picker, otherwise a
 * supplier selected in the card only sees whichever rows happened to land in
 * the first global sample.
 */
export async function loadInventoryActionCatalog(
	supabase: SupabaseClient,
	requestedCatalogId?: number,
	search: CatalogSearch = searchCatalog
): Promise<InventoryActionCatalogResult> {
	const byId = new Map<number, CatalogItem>();
	let offset = 0;
	let complete = true;

	while (true) {
		let page: CatalogItem[];
		try {
			page = await search(supabase, {
				stocked: true,
				sort: 'name',
				offset,
				limit: CATALOG_PAGE_SIZE
			});
		} catch (error) {
			if (byId.size === 0) throw error;
			complete = false;
			break;
		}

		for (const item of page) byId.set(item.id, item);
		if (page.length < CATALOG_PAGE_SIZE) break;
		offset += CATALOG_PAGE_SIZE;
	}

	if (requestedCatalogId && !byId.has(requestedCatalogId)) {
		const requested = await search(supabase, {
			ids: [requestedCatalogId],
			limit: 1
		});
		for (const item of requested) byId.set(item.id, item);
	}

	return { items: [...byId.values()], complete };
}
