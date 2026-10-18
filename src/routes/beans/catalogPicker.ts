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

/** Read one catalog coffee for the add form, including one that is no longer stocked. */
export async function loadCatalogCoffeeForForm(
	id: number,
	signal: AbortSignal,
	fetchCatalog: typeof fetch = fetch
): Promise<CoffeeCatalog | null> {
	const params = new URLSearchParams({ coffeeIds: String(id), stocked: 'all', limit: '1' });
	const response = await fetchCatalog(`/api/catalog?${params.toString()}`, { signal });
	if (!response.ok) throw new Error('Failed to fetch catalog coffee');
	const result = (await response.json()) as CatalogPageResponse;
	return result.data?.find((coffee) => coffee.id === id) ?? null;
}
