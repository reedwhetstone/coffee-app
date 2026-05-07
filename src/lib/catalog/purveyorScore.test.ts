import { describe, expect, it } from 'vitest';
import {
	calculatePurveyorScore,
	formatPurveyorScore,
	getPurveyorScoreSummary
} from './purveyorScore';
import type { CoffeeCatalog } from '$lib/types/component.types';

function createCoffee(overrides: Partial<CoffeeCatalog> = {}): CoffeeCatalog {
	return {
		id: 1,
		name: 'Colombia Huila',
		source: 'Example Importer',
		country: 'Colombia',
		region: 'Huila',
		continent: 'South America',
		farm_notes: 'Producer and farm details disclosed by supplier.',
		cultivar_detail: 'Caturra',
		grade: 'Excelso',
		appearance: 'Screen 15+',
		processing: 'Washed',
		processing_base_method: 'washed',
		fermentation_type: 'aerobic',
		process_additives: ['none'],
		process_additive_detail: null,
		fermentation_duration_hours: 36,
		drying_method: 'raised_bed',
		processing_notes: 'Washed and dried on raised beds.',
		processing_disclosure_level: 'high_detail',
		processing_confidence: 0.9,
		processing_evidence: { schema_version: 1 },
		processing_evidence_available: true,
		arrival_date: '2026-02-01',
		stocked: true,
		stocked_date: '2026-02-04',
		last_updated: '2026-02-05',
		price_per_lb: 8.75,
		cost_lb: 8.75,
		price_tiers: [
			{ min_lbs: 1, price: 8.75 },
			{ min_lbs: 10, price: 8.25 }
		],
		wholesale: false,
		ai_tasting_notes: { body: { score: 4, tag: 'silky', color: '#a07d50' } },
		cupping_notes: 'Citrus, panela, structured.',
		score_value: 87,
		roast_recs: 'City+',
		ai_description: 'A sweet washed Colombian coffee.',
		description_short: 'Sweet washed coffee',
		description_long: null,
		coffee_user: null,
		public_coffee: true,
		link: 'https://example.test/coffee',
		lot_size: '20 bags',
		bag_size: '60kg',
		packaging: 'GrainPro',
		type: 'Arabica',
		unstocked_date: null,
		purveyor_score: null,
		purveyor_score_confidence: null,
		purveyor_score_factors: {},
		purveyor_score_tier: null,
		purveyor_score_updated_at: null,
		purveyor_score_version: 'purveyor-score-v1',
		...overrides
	} as CoffeeCatalog;
}

describe('Purveyor Score', () => {
	it('rewards rich metadata without treating supplier cup score as the whole metric', () => {
		const summary = calculatePurveyorScore(createCoffee());

		expect(summary.score).toBe(100);
		expect(summary.tier).toBe('Exceptional');
		expect(summary.confidence).toBeGreaterThanOrEqual(0.9);
		expect(summary.factors.provenance_depth).toBe(25);
		expect(summary.factors.process_transparency).toBe(25);
		expect(summary.factors.pricing_comparability).toBe(15);
	});

	it('keeps sparse listings limited even when a price exists', () => {
		const summary = calculatePurveyorScore(
			createCoffee({
				country: null,
				region: null,
				farm_notes: null,
				cultivar_detail: null,
				grade: null,
				appearance: null,
				processing_base_method: null,
				fermentation_type: null,
				process_additives: null,
				fermentation_duration_hours: null,
				drying_method: null,
				processing_disclosure_level: null,
				processing_confidence: null,
				processing_evidence: null,
				processing_evidence_available: false,
				arrival_date: null,
				stocked_date: null,
				last_updated: null,
				price_tiers: null,
				ai_tasting_notes: null,
				cupping_notes: null,
				score_value: null,
				roast_recs: null,
				ai_description: null,
				description_short: null
			})
		);

		expect(summary.score).toBeLessThan(50);
		expect(summary.tier).toBe('Limited');
		expect(summary.factors.pricing_comparability).toBe(9);
		expect(summary.confidence).toBeLessThan(0.5);
	});

	it('prefers stored score fields when present', () => {
		const summary = getPurveyorScoreSummary(
			createCoffee({
				purveyor_score: 72,
				purveyor_score_tier: 'Strong',
				purveyor_score_confidence: 0.76,
				purveyor_score_factors: {
					provenance_depth: 20,
					process_transparency: 18,
					freshness_availability: 14,
					pricing_comparability: 12,
					sensory_context: 8,
					confidence_signals: {
						structured_signal_count: 7,
						recent_signal_count: 2,
						processing_confidence: 0.8,
						processing_evidence_available: true
					}
				}
			})
		);

		expect(summary.score).toBe(72);
		expect(summary.tier).toBe('Strong');
		expect(summary.confidence).toBe(0.76);
		expect(formatPurveyorScore(summary)).toBe('Purveyor Score 72 · Strong');
	});
});
