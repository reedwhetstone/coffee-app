import { describe, expect, it } from 'vitest';

import { createCatalogProofCoverage } from './proofCoverage';

describe('createCatalogProofCoverage', () => {
	it('summarizes proof labels, family gaps, and signal counts without raw evidence', () => {
		const coverage = createCatalogProofCoverage([
			{
				country: 'Ethiopia',
				region: 'Guji',
				source: 'supplier-a',
				stocked: true,
				stocked_date: '2026-05-01',
				arrival_date: '2026-04-20',
				price_per_lb: 8.5,
				price_tiers: [{ min_lbs: 1, price: 8.5 }],
				wholesale: false,
				processing_base_method: 'Natural',
				processing_disclosure_level: 'structured',
				processing_confidence: 0.9,
				processing_evidence_available: true,
				processing_notes: 'Supplier evidence should not be copied into coverage output.'
			},
			{
				country: 'Colombia',
				stocked: true,
				price_per_lb: 7,
				price_tiers: [
					{ min_lbs: 1, price: 7 },
					{ min_lbs: 10, price: 6.5 }
				],
				wholesale: true
			}
		]);

		expect(coverage.overall).toEqual([
			{ label: 'partial', count: 1, share: 0.5 },
			{ label: 'strong', count: 1, share: 0.5 }
		]);
		expect(coverage.families.process).toEqual([
			{ label: 'disclosed', count: 1, share: 0.5 },
			{ label: 'not_available', count: 1, share: 0.5 }
		]);
		expect(coverage.families.pricing).toEqual([
			{ label: 'listed', count: 1, share: 0.5 },
			{ label: 'tiered', count: 1, share: 0.5 }
		]);
		expect(coverage.signals).toMatchObject({
			'process.base_method': 1,
			'process.evidence_presence': 1,
			'freshness.stocked_date': 1,
			'pricing.price_tiers': 1,
			'pricing.price_per_lb': 2
		});
		expect(coverage.top_gaps).toContainEqual({
			family: 'process',
			label: 'not_available',
			count: 1,
			share: 0.5
		});
		expect(coverage.limitations).toEqual([
			'not_certification',
			'raw_evidence_not_included',
			'supplier_verification_not_performed'
		]);
		expect(JSON.stringify(coverage)).not.toContain('Supplier evidence');
	});

	it('returns empty distributions for an empty visible scope', () => {
		const coverage = createCatalogProofCoverage([]);

		expect(coverage.overall).toEqual([]);
		expect(coverage.families.process).toEqual([]);
		expect(coverage.signals).toEqual({});
		expect(coverage.top_gaps).toEqual([]);
	});
});
