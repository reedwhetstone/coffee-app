/**
 * Formatting utilities for bean profile data display.
 */

export interface PriceTier {
	min_lbs: number;
	price: number;
}

/**
 * Format price tiers into a readable string.
 * Example: "1 lb: $8.50 | 10 lb: $7.20 | 50 lb: $6.00"
 */
export function formatPriceTiers(tiers: PriceTier[] | null | undefined): string {
	if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return '';
	return [...tiers]
		.sort((a, b) => a.min_lbs - b.min_lbs)
		.map((t) => `${t.min_lbs} lb: $${t.price.toFixed(2)}`)
		.join(' | ');
}

/**
 * Format a date string for display. Returns "Mar 15, 2026" style.
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return dateStr;
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	} catch {
		return dateStr;
	}
}

/**
 * Format a supplier source name for display.
 * "sweet_marias" -> "Sweet Marias"
 */
export function formatSourceName(source: string | null | undefined): string {
	if (!source) return '';
	return source
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * Format a field key into a human-readable label.
 * "cultivar_detail" -> "Cultivar Detail"
 */
export function formatFieldLabel(key: string): string {
	return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build a location string from continent, country, region.
 */
export function formatLocation(
	continent: string | null | undefined,
	country: string | null | undefined,
	region: string | null | undefined
): string {
	return [continent, country, region].filter(Boolean).join(' > ');
}

/**
 * Format cost per pound with dollar sign.
 */
export function formatCostPerLb(cost: number | null | undefined): string {
	if (cost == null) return '';
	return `$${cost.toFixed(2)}/lb`;
}

/**
 * Format a cupping score value.
 */
export function formatScore(score: number | null | undefined): string {
	if (score == null) return '';
	return score.toFixed(1);
}
