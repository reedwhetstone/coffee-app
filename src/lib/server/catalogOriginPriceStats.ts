import { buildOriginPriceMap, type OriginPriceStats } from '$lib/catalog/priceContext';
import type { Json } from '$lib/types/database.types';
import type { CatalogVisibility } from './catalogVisibility';

export type CatalogPriceScope = 'retail' | 'wholesale' | 'all';

type CatalogPricingRow = {
	country: string | null;
	price_per_lb: number | null;
	cost_lb: number | null;
	price_tiers: Json | null;
	wholesale: boolean;
	source: string | null;
};

export function resolveCatalogPriceScope(visibility: CatalogVisibility): CatalogPriceScope {
	if (visibility.wholesaleOnly) return 'wholesale';
	return visibility.showWholesale ? 'all' : 'retail';
}

export async function loadCatalogOriginPriceStats(
	supabase: App.Locals['supabase'],
	visibility: CatalogVisibility
): Promise<OriginPriceStats[]> {
	let pricingQuery = supabase
		.from('coffee_catalog')
		.select('country, price_per_lb, cost_lb, price_tiers, wholesale, source')
		.eq('stocked', true);

	if (visibility.publicOnly) {
		pricingQuery = pricingQuery.eq('public_coffee', true);
	}

	const { data: pricingRows, error } = await pricingQuery.limit(5000);
	if (error) throw error;

	return Array.from(
		buildOriginPriceMap(
			(pricingRows ?? []) as CatalogPricingRow[],
			resolveCatalogPriceScope(visibility)
		).values()
	);
}
