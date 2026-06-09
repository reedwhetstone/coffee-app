import type { Json } from '$lib/types/database.types';
import { getDisplayPrice } from '$lib/utils/pricing';

export interface OriginPriceStats {
	origin: string;
	median: number;
	q1: number;
	q3: number;
	min: number;
	max: number;
	sample_size: number;
	supplier_count: number;
}

export type LotPriceTier = 'well_below' | 'below' | 'at' | 'above' | 'well_above';

export interface LotPriceContext {
	percent_diff: number;
	tier: LotPriceTier;
	label: string;
}

interface PriceableRow {
	country: string | null;
	price_per_lb: number | null;
	cost_lb?: number | null;
	price_tiers?: Json | null;
	wholesale: boolean;
	source?: string | null;
}

function getRowPrice(row: PriceableRow): number | null {
	return getDisplayPrice({
		cost_lb: row.cost_lb ?? null,
		price_per_lb: row.price_per_lb,
		price_tiers: row.price_tiers ?? null,
		wholesale: row.wholesale
	});
}

function computePercentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	if (sorted.length === 1) return sorted[0];
	const idx = p * (sorted.length - 1);
	const lo = Math.floor(idx);
	const hi = Math.ceil(idx);
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function buildOriginPriceMap(
	rows: PriceableRow[],
	scope: 'retail' | 'wholesale' | 'all' = 'retail'
): Map<string, OriginPriceStats> {
	const byCountry = new Map<string, { prices: number[]; suppliers: Set<string> }>();

	for (const row of rows) {
		if (scope === 'retail' && row.wholesale) continue;
		if (scope === 'wholesale' && !row.wholesale) continue;
		const price = getRowPrice(row);
		if (!row.country || price == null) continue;

		if (!byCountry.has(row.country)) {
			byCountry.set(row.country, { prices: [], suppliers: new Set<string>() });
		}
		const entry = byCountry.get(row.country)!;
		entry.prices.push(price);
		if (row.source) entry.suppliers.add(row.source);
	}

	const result = new Map<string, OriginPriceStats>();
	for (const [origin, { prices, suppliers }] of byCountry) {
		if (prices.length < 3) continue;
		const sorted = [...prices].sort((a, b) => a - b);
		result.set(origin, {
			origin,
			median: computePercentile(sorted, 0.5),
			q1: computePercentile(sorted, 0.25),
			q3: computePercentile(sorted, 0.75),
			min: sorted[0],
			max: sorted[sorted.length - 1],
			sample_size: sorted.length,
			supplier_count: suppliers.size
		});
	}

	return result;
}

export function getLotPriceContext(
	price: number | null | undefined,
	stats: OriginPriceStats | undefined
): LotPriceContext | null {
	if (price == null || stats == null || stats.median === 0) return null;

	const pctDiff = ((price - stats.median) / stats.median) * 100;
	const rounded = Math.round(pctDiff);

	let tier: LotPriceTier;
	let label: string;

	if (pctDiff <= -15) {
		tier = 'well_below';
		label = `${Math.abs(rounded)}% below median`;
	} else if (pctDiff < -5) {
		tier = 'below';
		label = `${Math.abs(rounded)}% below median`;
	} else if (pctDiff <= 5) {
		tier = 'at';
		label = 'Near median';
	} else if (pctDiff < 15) {
		tier = 'above';
		label = `${rounded}% above median`;
	} else {
		tier = 'well_above';
		label = `${rounded}% above median`;
	}

	return { percent_diff: rounded, tier, label };
}
