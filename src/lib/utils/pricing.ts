import type { Json } from '$lib/types/database.types';

/**
 * A single volume pricing tier.
 * `min_lbs` is the minimum order quantity (in pounds) for this price to apply.
 * `price` is the cost per pound at this tier.
 */
export interface PriceTier {
	min_lbs: number;
	price: number;
}

/**
 * Minimal coffee shape needed by pricing utilities.
 * Avoids coupling to the full CoffeeCatalog type.
 */
export interface PriceableCoffee {
	cost_lb: number | null;
	price_tiers: Json | null;
	wholesale: boolean;
}

/**
 * Parse raw jsonb `price_tiers` into typed tiers, sorted by `min_lbs` ascending.
 * Returns null if the input is null, not an array, or contains no valid tiers.
 */
export function parsePriceTiers(raw: Json | null | undefined): PriceTier[] | null {
	if (raw == null) return null;

	let arr: unknown[];
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return null;
			arr = parsed;
		} catch {
			return null;
		}
	} else if (Array.isArray(raw)) {
		arr = raw;
	} else {
		return null;
	}

	const tiers: PriceTier[] = [];
	for (const item of arr) {
		if (
			item != null &&
			typeof item === 'object' &&
			'min_lbs' in item &&
			'price' in item &&
			typeof (item as Record<string, unknown>).min_lbs === 'number' &&
			typeof (item as Record<string, unknown>).price === 'number' &&
			(item as PriceTier).min_lbs > 0 &&
			(item as PriceTier).price > 0
		) {
			tiers.push({
				min_lbs: (item as PriceTier).min_lbs,
				price: (item as PriceTier).price
			});
		}
	}

	if (tiers.length === 0) return null;

	tiers.sort((a, b) => a.min_lbs - b.min_lbs);
	return tiers;
}

/**
 * Get the display price for a coffee (the base $/lb shown on cards).
 * Uses `cost_lb` as the canonical display value. This is always populated
 * with the lowest-tier $/lb by the scraper.
 * Falls back to the first tier's price if `cost_lb` is null but tiers exist.
 */
export function getDisplayPrice(coffee: PriceableCoffee): number | null {
	if (coffee.cost_lb != null) return coffee.cost_lb;

	const tiers = parsePriceTiers(coffee.price_tiers);
	if (tiers && tiers.length > 0) return tiers[0].price;

	return null;
}

/**
 * Get the applicable tier for a given quantity in pounds.
 * Returns the highest tier whose `min_lbs` is <= the requested quantity.
 * Returns null if no tier applies (quantity below the smallest min).
 */
export function getApplicableTier(tiers: PriceTier[], lbs: number): PriceTier | null {
	if (tiers.length === 0 || lbs <= 0) return null;

	// Tiers should already be sorted ascending, but ensure it
	const sorted = [...tiers].sort((a, b) => a.min_lbs - b.min_lbs);

	let applicable: PriceTier | null = null;
	for (const tier of sorted) {
		if (lbs >= tier.min_lbs) {
			applicable = tier;
		} else {
			break;
		}
	}

	return applicable;
}

/**
 * Get the $/lb at a specific quantity.
 * Returns null if the quantity is below the minimum tier.
 */
export function getPriceAtQuantity(tiers: PriceTier[], lbs: number): number | null {
	const tier = getApplicableTier(tiers, lbs);
	return tier ? tier.price : null;
}

/**
 * Calculate the total purchase cost for a given quantity.
 * Uses the applicable tier's per-lb price * quantity.
 * Returns null if no tier applies.
 */
export function calculatePurchaseTotal(tiers: PriceTier[], lbs: number): number | null {
	const pricePerLb = getPriceAtQuantity(tiers, lbs);
	if (pricePerLb == null) return null;
	return Math.round(pricePerLb * lbs * 100) / 100;
}

/**
 * Format a price as "$X.XX/lb".
 */
export function formatPricePerLb(price: number): string {
	return `$${price.toFixed(2)}/lb`;
}

/**
 * Format a price tier for display: "5+ lb: $15.00/lb"
 */
export function formatTier(tier: PriceTier): string {
	return `${tier.min_lbs}+ lb: ${formatPricePerLb(tier.price)}`;
}

/**
 * Check if a coffee has multiple price tiers (i.e., volume pricing is relevant).
 */
export function hasMultipleTiers(coffee: PriceableCoffee): boolean {
	const tiers = parsePriceTiers(coffee.price_tiers);
	return tiers != null && tiers.length > 1;
}

/**
 * Get the minimum order quantity for a coffee.
 * Returns 1 if no tiers exist, otherwise the smallest tier's min_lbs.
 */
export function getMinOrderLbs(coffee: PriceableCoffee): number {
	const tiers = parsePriceTiers(coffee.price_tiers);
	if (!tiers || tiers.length === 0) return 1;
	return tiers[0].min_lbs;
}

/**
 * Get the price savings summary between lowest and highest tier.
 * Returns null if there's only one tier or no tiers.
 * Useful for showing "Save up to X% on bulk orders".
 */
export function getBulkSavings(
	tiers: PriceTier[]
): { percentOff: number; lowestPrice: number; highestPrice: number } | null {
	if (tiers.length < 2) return null;

	const sorted = [...tiers].sort((a, b) => a.min_lbs - b.min_lbs);
	const highestPrice = sorted[0].price; // smallest quantity = highest price
	const lowestPrice = sorted[sorted.length - 1].price; // largest quantity = lowest price

	if (highestPrice <= 0) return null;

	const percentOff = Math.round(((highestPrice - lowestPrice) / highestPrice) * 100);
	return { percentOff, lowestPrice, highestPrice };
}
