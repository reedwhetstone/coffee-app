import { MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';
import type { CoffeeCatalog } from '$lib/types/component.types';

interface CatalogPageResponse {
	data?: CoffeeCatalog[];
	pagination?: {
		page?: number;
		hasNext?: boolean;
	};
}

export async function loadBeanPickerCatalog(fetchCatalog: typeof fetch): Promise<CoffeeCatalog[]> {
	const catalog: CoffeeCatalog[] = [];
	let page = 1;
	let hasNext = true;

	while (hasNext) {
		const params = new URLSearchParams({
			page: String(page),
			limit: String(MAX_CATALOG_PAGE_LIMIT)
		});
		const response = await fetchCatalog(`/api/catalog?${params.toString()}`);

		if (!response.ok) {
			throw new Error('Failed to fetch catalog data');
		}

		const result = (await response.json()) as CatalogPageResponse | CoffeeCatalog[];
		if (Array.isArray(result)) {
			catalog.push(...result);
			break;
		}

		if (Array.isArray(result.data)) {
			catalog.push(...result.data);
		}

		hasNext = result.pagination?.hasNext === true;
		page = (result.pagination?.page ?? page) + 1;
	}

	return catalog;
}
