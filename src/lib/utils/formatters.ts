/**
 * Formatting utilities for bean profile data display.
 */

import { parsePriceTiers } from '$lib/utils/pricing';
export type { PriceTier } from '$lib/utils/pricing';

/**
 * Format price tiers into a readable string.
 * Example: "1 lb: $8.50 | 10 lb: $7.20 | 50 lb: $6.00"
 * Delegates parsing/validation to parsePriceTiers; only handles display formatting.
 */
export function formatPriceTiers(tiers: unknown): string {
	const parsed = parsePriceTiers(tiers as Parameters<typeof parsePriceTiers>[0]);
	if (!parsed) return '';
	return parsed.map((t) => `${t.min_lbs} lb: $${t.price.toFixed(2)}`).join(' | ');
}

/**
 * Format a date string for display. Returns "Mar 15, 2026" style.
 * Appends 'T00:00:00' to prevent UTC parsing and timezone off-by-one for
 * users west of UTC (e.g. "2026-03-15" would become Mar 14 without this fix).
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	try {
		// Split manually to avoid UTC midnight parsing
		const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
		const date = new Date(year, month - 1, day);
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
