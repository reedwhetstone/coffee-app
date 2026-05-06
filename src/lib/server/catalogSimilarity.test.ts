import { describe, expect, it } from 'vitest';
import {
	deriveMatchCategory,
	getPriceFromTiersAtQuantity,
	normalizeCanonicalPricing,
	normalizeSimilarityRow,
	parseCatalogSimilarityQuery
} from './catalogSimilarity';

describe('catalog similarity helpers', () => {
	it('prefers canonical price_per_lb before tier and legacy cost fallback', () => {
		expect(
			normalizeCanonicalPricing({
				price_per_lb: 7.5,
				price_tiers: [{ min_lbs: 1, price: 7.25 }],
				cost_lb: 6.1
			})
		).toMatchObject({ baseline_price_per_lb: 7.5, baseline_source: 'price_per_lb' });

		expect(
			normalizeCanonicalPricing({
				price_per_lb: null,
				price_tiers: [{ min_lbs: 1, price: 7.25 }],
				cost_lb: 6.1
			})
		).toMatchObject({ baseline_price_per_lb: 7.25, baseline_source: 'price_tiers' });

		expect(
			normalizeCanonicalPricing({ price_per_lb: null, price_tiers: null, cost_lb: 6.1 })
		).toMatchObject({ baseline_price_per_lb: 6.1, baseline_source: 'cost_lb' });
	});

	it('keeps price tiers available for future side-by-side comparison', () => {
		const priceTiers = [
			{ min_lbs: 1, price: 8.5 },
			{ min_lbs: 5, price: 7.9 }
		];

		expect(getPriceFromTiersAtQuantity(priceTiers, 1)).toBe(8.5);
		expect(getPriceFromTiersAtQuantity(priceTiers, 5)).toBe(7.9);
		expect(
			normalizeCanonicalPricing({ price_per_lb: null, price_tiers: priceTiers, cost_lb: null })
		).toMatchObject({
			price_tiers: priceTiers,
			baseline_quantity_lbs: 1
		});
	});

	it('does not treat higher-minimum tiers as a 1 lb baseline', () => {
		expect(getPriceFromTiersAtQuantity([{ min_lbs: 5, price: 6.25 }], 1)).toBeNull();
		expect(
			normalizeCanonicalPricing({
				price_per_lb: null,
				price_tiers: [{ min_lbs: 5, price: 6.25 }],
				cost_lb: null
			})
		).toMatchObject({ baseline_price_per_lb: null, baseline_source: null });
		expect(
			normalizeCanonicalPricing({
				price_per_lb: null,
				price_tiers: [{ min_lbs: 5, price: 6.25 }],
				cost_lb: 7
			})
		).toMatchObject({ baseline_price_per_lb: 7, baseline_source: 'cost_lb' });
	});

	it('derives beta categories without overclaiming canonical certainty', () => {
		expect(
			deriveMatchCategory({ average: 0.91, origin: 0.89, processing: 0.9, chunkMatches: 2 })
		).toBe('likely_same');
		expect(
			deriveMatchCategory({ average: 0.91, origin: 0.7, processing: 0.9, chunkMatches: 2 })
		).toBe('similar_profile');
		expect(
			deriveMatchCategory({ average: 0.95, origin: null, processing: null, chunkMatches: 4 })
		).toBe('similar_profile');
	});

	it('uses raw scores for classification before rounding display scores', () => {
		const targetPricing = normalizeCanonicalPricing({
			price_per_lb: 8,
			price_tiers: null,
			cost_lb: null
		});

		const match = normalizeSimilarityRow(
			{
				coffee_id: 43,
				coffee_name: 'Borderline Coffee',
				source: 'Supplier C',
				origin: 'Borderline',
				country: 'Colombia',
				continent: 'South America',
				processing: 'Washed',
				processing_base_method: 'washed',
				fermentation_type: null,
				drying_method: null,
				cost_lb: null,
				price_per_lb: null,
				price_tiers: null,
				stocked: true,
				avg_similarity: 0.8796,
				origin_similarity: 0.8996,
				processing_similarity: 0.8996,
				tasting_similarity: null,
				chunk_matches: 2
			},
			targetPricing
		);

		expect(match.score).toMatchObject({
			average: 0.88,
			dimensions: { origin: 0.9, processing: 0.9, tasting: null }
		});
		expect(match.match).toMatchObject({
			category: 'similar_profile',
			confidence: 'medium_beta'
		});
	});

	it('normalizes RPC rows with canonical pricing, deltas, dimensions, and confidence copy', () => {
		const targetPricing = normalizeCanonicalPricing({
			price_per_lb: null,
			price_tiers: [{ min_lbs: 1, price: 8 }],
			cost_lb: 7
		});

		const match = normalizeSimilarityRow(
			{
				coffee_id: 42,
				coffee_name: 'Ethiopia Guji Natural',
				source: 'Supplier B',
				origin: 'Guji',
				country: 'Ethiopia',
				continent: 'Africa',
				processing: 'Natural',
				processing_base_method: 'natural',
				fermentation_type: null,
				drying_method: 'Raised bed',
				cost_lb: '6.5',
				price_per_lb: '8.75',
				price_tiers: [{ min_lbs: 1, price: 8.75 }],
				stocked: true,
				avg_similarity: 0.92,
				origin_similarity: 0.94,
				processing_similarity: 0.91,
				tasting_similarity: 0.87,
				chunk_matches: 3
			},
			targetPricing
		);

		expect(match.pricing).toMatchObject({
			price_per_lb: 8.75,
			baseline_price_per_lb: 8.75,
			baseline_source: 'price_per_lb'
		});
		expect(match.compatibility.cost_lb).toBe(6.5);
		expect(match.price_delta_1lb).toMatchObject({ amount: 0.75, percent: 9.4 });
		expect(match.score.dimensions).toEqual({ origin: 0.94, processing: 0.91, tasting: 0.87 });
		expect(match.match).toMatchObject({
			category: 'likely_same',
			confidence: 'high_beta',
			beta: true
		});
		expect(match.match.language).toContain('beta confidence');
	});

	it('validates threshold, limit, stocked_only, and mode query params', () => {
		const query = parseCatalogSimilarityQuery(
			new URL(
				'https://app.test/v1/catalog/1/similar?threshold=0.82&limit=5&stocked_only=false&mode=likely_same'
			)
		);

		expect(query).toEqual({ threshold: 0.82, limit: 5, stockedOnly: false, mode: 'likely_same' });
		expect(() =>
			parseCatalogSimilarityQuery(new URL('https://app.test/v1/catalog/1/similar?threshold=0.2'))
		).toThrow('threshold');
		expect(() =>
			parseCatalogSimilarityQuery(new URL('https://app.test/v1/catalog/1/similar?limit=100'))
		).toThrow('limit');
		expect(() =>
			parseCatalogSimilarityQuery(new URL('https://app.test/v1/catalog/1/similar?stocked_only=yes'))
		).toThrow('stocked_only');
		expect(() =>
			parseCatalogSimilarityQuery(new URL('https://app.test/v1/catalog/1/similar?mode=canonical'))
		).toThrow('mode');
	});
});
