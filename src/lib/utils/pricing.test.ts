import { describe, it, expect } from 'vitest';
import type { Json } from '$lib/types/database.types';
import {
	parsePriceTiers,
	getDisplayPrice,
	getApplicableTier,
	getPriceAtQuantity,
	calculatePurchaseTotal,
	formatPricePerLb,
	formatTier,
	hasMultipleTiers,
	getMinOrderLbs,
	getBulkSavings,
	type PriceTier,
	type PriceableCoffee
} from './pricing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCoffee(overrides: Partial<PriceableCoffee> = {}): PriceableCoffee {
	return {
		cost_lb: 10,
		price_tiers: null,
		wholesale: false,
		...overrides
	};
}

/** Cast PriceTier[] to Json for use in PriceableCoffee.price_tiers */
const asJson = (tiers: PriceTier[]): Json => tiers as unknown as Json;

const RETAIL_TIERS: PriceTier[] = [
	{ min_lbs: 1, price: 20 },
	{ min_lbs: 5, price: 15 },
	{ min_lbs: 25, price: 10 }
];

const WHOLESALE_TIERS: PriceTier[] = [
	{ min_lbs: 10, price: 8 },
	{ min_lbs: 50, price: 6 },
	{ min_lbs: 100, price: 4.5 }
];

const SINGLE_TIER: PriceTier[] = [{ min_lbs: 1, price: 12 }];

// ---------------------------------------------------------------------------
// parsePriceTiers
// ---------------------------------------------------------------------------

describe('parsePriceTiers', () => {
	it('returns null for null input', () => {
		expect(parsePriceTiers(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(parsePriceTiers(undefined)).toBeNull();
	});

	it('returns null for non-array JSON', () => {
		expect(parsePriceTiers({ min_lbs: 1, price: 10 })).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(parsePriceTiers([])).toBeNull();
	});

	it('returns null for string that is not valid JSON', () => {
		expect(parsePriceTiers('not json' as unknown as null)).toBeNull();
	});

	it('returns null for JSON string that is not an array', () => {
		expect(parsePriceTiers('{"min_lbs": 1}' as unknown as null)).toBeNull();
	});

	it('parses valid JSON array', () => {
		const raw = [
			{ min_lbs: 5, price: 15 },
			{ min_lbs: 1, price: 20 }
		];
		const result = parsePriceTiers(raw);
		expect(result).toEqual([
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 5, price: 15 }
		]);
	});

	it('parses valid JSON string', () => {
		const raw = JSON.stringify([
			{ min_lbs: 10, price: 8 },
			{ min_lbs: 1, price: 12 }
		]);
		const result = parsePriceTiers(raw as unknown as null);
		expect(result).toEqual([
			{ min_lbs: 1, price: 12 },
			{ min_lbs: 10, price: 8 }
		]);
	});

	it('sorts tiers by min_lbs ascending', () => {
		const raw = [
			{ min_lbs: 50, price: 6 },
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 10, price: 10 }
		];
		const result = parsePriceTiers(raw);
		expect(result).toEqual([
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 10, price: 10 },
			{ min_lbs: 50, price: 6 }
		]);
	});

	it('filters out tiers with missing fields', () => {
		const raw = [
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 5 }, // missing price
			{ price: 10 }, // missing min_lbs
			{ min_lbs: 10, price: 8 }
		];
		const result = parsePriceTiers(raw as unknown as null);
		expect(result).toEqual([
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 10, price: 8 }
		]);
	});

	it('filters out tiers with non-numeric fields', () => {
		const raw = [
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 'five', price: 15 },
			{ min_lbs: 10, price: 'cheap' }
		];
		const result = parsePriceTiers(raw as unknown as null);
		expect(result).toEqual([{ min_lbs: 1, price: 20 }]);
	});

	it('filters out tiers with zero or negative values', () => {
		const raw = [
			{ min_lbs: 0, price: 20 },
			{ min_lbs: 1, price: -5 },
			{ min_lbs: 5, price: 15 }
		];
		const result = parsePriceTiers(raw);
		expect(result).toEqual([{ min_lbs: 5, price: 15 }]);
	});

	it('filters out null items in array', () => {
		const raw = [null, { min_lbs: 1, price: 20 }, undefined, { min_lbs: 5, price: 15 }];
		const result = parsePriceTiers(raw as unknown as null);
		expect(result).toEqual([
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 5, price: 15 }
		]);
	});

	it('returns null when all items are invalid', () => {
		const raw = [{ min_lbs: 0, price: 0 }, null, { bad: 'data' }];
		expect(parsePriceTiers(raw as unknown as null)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getDisplayPrice
// ---------------------------------------------------------------------------

describe('getDisplayPrice', () => {
	it('returns cost_lb when available', () => {
		const coffee = makeCoffee({ cost_lb: 15 });
		expect(getDisplayPrice(coffee)).toBe(15);
	});

	it('returns cost_lb even when price_tiers exist', () => {
		const coffee = makeCoffee({ cost_lb: 20, price_tiers: asJson(RETAIL_TIERS) });
		expect(getDisplayPrice(coffee)).toBe(20);
	});

	it('falls back to first tier price when cost_lb is null', () => {
		const coffee = makeCoffee({ cost_lb: null, price_tiers: asJson(RETAIL_TIERS) });
		expect(getDisplayPrice(coffee)).toBe(20);
	});

	it('returns null when both cost_lb and price_tiers are null', () => {
		const coffee = makeCoffee({ cost_lb: null, price_tiers: null });
		expect(getDisplayPrice(coffee)).toBeNull();
	});

	it('returns null when cost_lb is null and price_tiers is invalid', () => {
		const coffee = makeCoffee({ cost_lb: null, price_tiers: 'garbage' as unknown as null });
		expect(getDisplayPrice(coffee)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getApplicableTier
// ---------------------------------------------------------------------------

describe('getApplicableTier', () => {
	it('returns null for empty tiers', () => {
		expect(getApplicableTier([], 5)).toBeNull();
	});

	it('returns null for zero quantity', () => {
		expect(getApplicableTier(RETAIL_TIERS, 0)).toBeNull();
	});

	it('returns null for negative quantity', () => {
		expect(getApplicableTier(RETAIL_TIERS, -1)).toBeNull();
	});

	it('returns first tier at exact min_lbs', () => {
		const tier = getApplicableTier(RETAIL_TIERS, 1);
		expect(tier).toEqual({ min_lbs: 1, price: 20 });
	});

	it('returns correct tier between breakpoints', () => {
		const tier = getApplicableTier(RETAIL_TIERS, 3);
		expect(tier).toEqual({ min_lbs: 1, price: 20 });
	});

	it('returns second tier at exact breakpoint', () => {
		const tier = getApplicableTier(RETAIL_TIERS, 5);
		expect(tier).toEqual({ min_lbs: 5, price: 15 });
	});

	it('returns highest applicable tier for large quantity', () => {
		const tier = getApplicableTier(RETAIL_TIERS, 100);
		expect(tier).toEqual({ min_lbs: 25, price: 10 });
	});

	it('returns null when quantity is below minimum wholesale tier', () => {
		const tier = getApplicableTier(WHOLESALE_TIERS, 5);
		expect(tier).toBeNull();
	});

	it('returns correct wholesale tier at exact min', () => {
		const tier = getApplicableTier(WHOLESALE_TIERS, 10);
		expect(tier).toEqual({ min_lbs: 10, price: 8 });
	});

	it('handles unsorted input', () => {
		const unsorted: PriceTier[] = [
			{ min_lbs: 25, price: 10 },
			{ min_lbs: 1, price: 20 },
			{ min_lbs: 5, price: 15 }
		];
		const tier = getApplicableTier(unsorted, 7);
		expect(tier).toEqual({ min_lbs: 5, price: 15 });
	});
});

// ---------------------------------------------------------------------------
// getPriceAtQuantity
// ---------------------------------------------------------------------------

describe('getPriceAtQuantity', () => {
	it('returns price at exact tier', () => {
		expect(getPriceAtQuantity(RETAIL_TIERS, 5)).toBe(15);
	});

	it('returns lower tier price between breakpoints', () => {
		expect(getPriceAtQuantity(RETAIL_TIERS, 12)).toBe(15);
	});

	it('returns null below minimum', () => {
		expect(getPriceAtQuantity(WHOLESALE_TIERS, 3)).toBeNull();
	});

	it('returns highest tier for large quantity', () => {
		expect(getPriceAtQuantity(RETAIL_TIERS, 1000)).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// calculatePurchaseTotal
// ---------------------------------------------------------------------------

describe('calculatePurchaseTotal', () => {
	it('calculates total for exact tier quantity', () => {
		expect(calculatePurchaseTotal(RETAIL_TIERS, 5)).toBe(75); // 5 * $15
	});

	it('calculates total between tiers', () => {
		expect(calculatePurchaseTotal(RETAIL_TIERS, 3)).toBe(60); // 3 * $20
	});

	it('calculates total at highest tier', () => {
		expect(calculatePurchaseTotal(RETAIL_TIERS, 50)).toBe(500); // 50 * $10
	});

	it('returns null below minimum tier', () => {
		expect(calculatePurchaseTotal(WHOLESALE_TIERS, 5)).toBeNull();
	});

	it('handles fractional quantities', () => {
		expect(calculatePurchaseTotal(RETAIL_TIERS, 2.5)).toBe(50); // 2.5 * $20
	});

	it('rounds to 2 decimal places', () => {
		const tiers: PriceTier[] = [{ min_lbs: 1, price: 7.33 }];
		expect(calculatePurchaseTotal(tiers, 3)).toBe(21.99); // 7.33 * 3 = 21.99
	});

	it('returns null for empty tiers', () => {
		expect(calculatePurchaseTotal([], 10)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// formatPricePerLb
// ---------------------------------------------------------------------------

describe('formatPricePerLb', () => {
	it('formats whole dollar amount', () => {
		expect(formatPricePerLb(10)).toBe('$10.00/lb');
	});

	it('formats with cents', () => {
		expect(formatPricePerLb(7.5)).toBe('$7.50/lb');
	});

	it('formats precise cents', () => {
		expect(formatPricePerLb(4.99)).toBe('$4.99/lb');
	});

	it('formats sub-dollar amount', () => {
		expect(formatPricePerLb(0.5)).toBe('$0.50/lb');
	});
});

// ---------------------------------------------------------------------------
// formatTier
// ---------------------------------------------------------------------------

describe('formatTier', () => {
	it('formats a retail tier', () => {
		expect(formatTier({ min_lbs: 1, price: 20 })).toBe('1+ lb: $20.00/lb');
	});

	it('formats a bulk tier', () => {
		expect(formatTier({ min_lbs: 50, price: 6 })).toBe('50+ lb: $6.00/lb');
	});

	it('formats a tier with cents', () => {
		expect(formatTier({ min_lbs: 100, price: 4.5 })).toBe('100+ lb: $4.50/lb');
	});
});

// ---------------------------------------------------------------------------
// hasMultipleTiers
// ---------------------------------------------------------------------------

describe('hasMultipleTiers', () => {
	it('returns false when price_tiers is null', () => {
		expect(hasMultipleTiers(makeCoffee({ price_tiers: null }))).toBe(false);
	});

	it('returns false for single tier', () => {
		expect(hasMultipleTiers(makeCoffee({ price_tiers: asJson(SINGLE_TIER) }))).toBe(false);
	});

	it('returns true for multiple tiers', () => {
		expect(hasMultipleTiers(makeCoffee({ price_tiers: asJson(RETAIL_TIERS) }))).toBe(true);
	});

	it('returns false for empty array', () => {
		expect(hasMultipleTiers(makeCoffee({ price_tiers: asJson([]) }))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getMinOrderLbs
// ---------------------------------------------------------------------------

describe('getMinOrderLbs', () => {
	it('returns 1 when no tiers', () => {
		expect(getMinOrderLbs(makeCoffee({ price_tiers: null }))).toBe(1);
	});

	it('returns 1 for retail tiers starting at 1 lb', () => {
		expect(getMinOrderLbs(makeCoffee({ price_tiers: asJson(RETAIL_TIERS) }))).toBe(1);
	});

	it('returns 10 for wholesale tiers starting at 10 lb', () => {
		expect(getMinOrderLbs(makeCoffee({ price_tiers: asJson(WHOLESALE_TIERS) }))).toBe(10);
	});

	it('returns 1 for empty tiers array', () => {
		expect(getMinOrderLbs(makeCoffee({ price_tiers: asJson([]) }))).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// getBulkSavings
// ---------------------------------------------------------------------------

describe('getBulkSavings', () => {
	it('returns null for single tier', () => {
		expect(getBulkSavings(SINGLE_TIER)).toBeNull();
	});

	it('returns null for empty tiers', () => {
		expect(getBulkSavings([])).toBeNull();
	});

	it('calculates savings for retail tiers', () => {
		const savings = getBulkSavings(RETAIL_TIERS);
		expect(savings).toEqual({
			percentOff: 50, // ($20 - $10) / $20 = 50%
			lowestPrice: 10,
			highestPrice: 20
		});
	});

	it('calculates savings for wholesale tiers', () => {
		const savings = getBulkSavings(WHOLESALE_TIERS);
		expect(savings).toEqual({
			percentOff: 44, // ($8 - $4.50) / $8 = 43.75%, rounded to 44
			lowestPrice: 4.5,
			highestPrice: 8
		});
	});

	it('handles unsorted tiers', () => {
		const unsorted: PriceTier[] = [
			{ min_lbs: 50, price: 6 },
			{ min_lbs: 1, price: 20 }
		];
		const savings = getBulkSavings(unsorted);
		expect(savings).toEqual({
			percentOff: 70, // ($20 - $6) / $20 = 70%
			lowestPrice: 6,
			highestPrice: 20
		});
	});
});
