import { describe, expect, it } from 'vitest';
import { createCatalogProofSummary, getCatalogProofBadges } from './proofSummary';

describe('createCatalogProofSummary', () => {
	it('builds cautious proof families from existing catalog signals without raw evidence', () => {
		const summary = createCatalogProofSummary({
			country: 'Ethiopia',
			region: 'Guji',
			farm_notes: 'Smallholder station detail exists',
			source: 'Example Importer',
			arrival_date: '2026-04-01',
			stocked_date: '2026-04-15',
			last_updated: '2026-04-20T00:00:00Z',
			stocked: true,
			price_per_lb: 8.75,
			price_tiers: [
				{ min_lbs: 1, price: 8.75 },
				{ min_lbs: 10, price: 8.25 }
			],
			wholesale: false,
			process: {
				base_method: 'Natural',
				fermentation_type: 'Anaerobic',
				additives: ['none'],
				additive_detail: null,
				fermentation_duration_hours: 72,
				drying_method: 'Raised beds',
				notes: 'Supplier notes exist but are not returned here',
				disclosure_level: 'high_detail',
				confidence: 0.91,
				evidence_available: true
			}
		});

		expect(summary).toMatchObject({
			version: 'proof-summary-v1',
			overall: { label: 'strong', families_with_signals: 4 },
			families: {
				process: {
					label: 'disclosed',
					confidence: 0.91,
					signals: expect.arrayContaining([
						'base_method',
						'fermentation_type',
						'disclosure_level',
						'confidence_score',
						'evidence_presence'
					])
				},
				provenance: {
					label: 'identified',
					signals: expect.arrayContaining(['country', 'region', 'farm_notes_present'])
				},
				freshness: {
					label: 'recently_stocked',
					signals: expect.arrayContaining(['stocked_date', 'arrival_date', 'currently_stocked'])
				},
				pricing: {
					label: 'tiered',
					signals: expect.arrayContaining(['price_per_lb', 'price_tiers'])
				}
			},
			limitations: [
				'not_certification',
				'raw_evidence_not_included',
				'supplier_verification_not_performed'
			]
		});
		expect(JSON.stringify(summary)).not.toContain('Supplier notes exist');
	});

	it('preserves null semantics instead of treating missing data as negative proof', () => {
		const summary = createCatalogProofSummary({
			country: null,
			region: null,
			arrival_date: null,
			stocked_date: null,
			last_updated: null,
			price_per_lb: null,
			price_tiers: null,
			process: {
				base_method: null,
				fermentation_type: null,
				additives: null,
				additive_detail: null,
				fermentation_duration_hours: null,
				drying_method: null,
				notes: null,
				disclosure_level: null,
				confidence: null,
				evidence_available: false
			}
		});

		expect(summary.overall).toEqual({ label: 'not_available', families_with_signals: 0 });
		expect(summary.families.process).toMatchObject({
			label: 'not_available',
			confidence: null,
			signals: []
		});
		expect(summary.families.provenance.label).toBe('not_available');
		expect(summary.families.freshness.label).toBe('not_available');
		expect(summary.families.pricing.label).toBe('not_available');
	});

	it('supports legacy catalog fields when nested process summaries are absent', () => {
		const summary = createCatalogProofSummary({
			country: 'Colombia',
			region: null,
			processing_base_method: 'Washed',
			processing_disclosure_level: 'structured',
			processing_confidence: 0.83,
			processing_evidence_available: true,
			processing_notes: 'Existing process note should only become a presence signal',
			price_per_lb: 7.5,
			price_tiers: JSON.stringify([{ min_lbs: 1, price: 7.5 }])
		});

		expect(summary.families.process).toMatchObject({
			label: 'disclosed',
			confidence: 0.83,
			signals: expect.arrayContaining([
				'base_method',
				'disclosure_level',
				'confidence_score',
				'evidence_presence',
				'process_notes_present'
			])
		});
		expect(summary.families.provenance).toMatchObject({
			label: 'partial',
			signals: ['country']
		});
		expect(summary.families.pricing.label).toBe('listed');
		expect(JSON.stringify(summary)).not.toContain('Existing process note');
	});

	it('uses the legacy top-level evidence flag when process evidence is absent', () => {
		const summary = createCatalogProofSummary({
			processing_base_method: 'Washed',
			processing_evidence_available: true
		});

		expect(summary.families.process).toMatchObject({
			label: 'disclosed',
			confidence: null,
			signals: expect.arrayContaining(['base_method', 'evidence_presence'])
		});
	});
});

describe('getCatalogProofBadges', () => {
	it('returns compact public badges only for families with usable signals', () => {
		const summary = createCatalogProofSummary({
			country: 'Kenya',
			region: 'Nyeri',
			source: 'Example Importer',
			stocked_date: '2026-04-01',
			stocked: true,
			price_per_lb: 9,
			price_tiers: [{ min_lbs: 1, price: 9 }],
			process: {
				base_method: 'Washed',
				disclosure_level: 'label_only',
				confidence: 0.8,
				evidence_available: true
			}
		});

		expect(getCatalogProofBadges(summary).map((badge) => badge.label)).toEqual([
			'Process disclosed',
			'Provenance identified',
			'Freshness dated',
			'Price listed'
		]);
	});

	it('does not render badges when all families are unavailable', () => {
		const summary = createCatalogProofSummary({});

		expect(getCatalogProofBadges(summary)).toEqual([]);
	});
});
