import { describe, expect, it } from 'vitest';
import {
	SourcingBriefCriteriaValidationError,
	sourcingBriefCriteriaToCatalogSearchOptions,
	validateSourcingBriefCriteria
} from './sourcingBriefCriteria';

describe('validateSourcingBriefCriteria', () => {
	it('normalizes supported criteria with a versioned contract', () => {
		expect(
			validateSourcingBriefCriteria({
				country: ' Colombia ',
				max_price_per_lb: 6.505,
				stocked_only: true,
				wholesale_only: false,
				stocked_days: 30
			})
		).toEqual({
			version: 1,
			country: 'Colombia',
			max_price_per_lb: 6.5,
			stocked_only: true,
			stocked_days: 30
		});
	});

	it('rejects unsupported criteria instead of silently ignoring them', () => {
		expect(() => validateSourcingBriefCriteria({ country: 'Colombia', score_min: 86 })).toThrow(
			SourcingBriefCriteriaValidationError
		);

		try {
			validateSourcingBriefCriteria({ country: 'Colombia', score_min: 86 });
		} catch (error) {
			expect(error).toBeInstanceOf(SourcingBriefCriteriaValidationError);
			expect((error as SourcingBriefCriteriaValidationError).issues).toContainEqual(
				expect.objectContaining({ field: 'score_min' })
			);
		}
	});

	it('requires at least one supported sourcing constraint', () => {
		expect(() => validateSourcingBriefCriteria({ version: 1 })).toThrow(
			SourcingBriefCriteriaValidationError
		);
	});

	it('does not count no-op boolean flags as sourcing constraints', () => {
		expect(() => validateSourcingBriefCriteria({ stocked_only: false })).toThrow(
			SourcingBriefCriteriaValidationError
		);
		expect(() => validateSourcingBriefCriteria({ wholesale_only: false })).toThrow(
			SourcingBriefCriteriaValidationError
		);
		expect(validateSourcingBriefCriteria({ country: 'Colombia', wholesale_only: false })).toEqual({
			version: 1,
			country: 'Colombia'
		});
	});

	it('maps criteria to pre-pagination catalog filters', () => {
		expect(
			sourcingBriefCriteriaToCatalogSearchOptions(
				validateSourcingBriefCriteria({
					country: 'Colombia',
					processing_base_method: 'Washed',
					max_price_per_lb: 6.5,
					stocked_only: true,
					wholesale_only: true,
					stocked_days: 14
				})
			)
		).toEqual({
			country: 'Colombia',
			region: undefined,
			processing: undefined,
			processingBaseMethod: 'Washed',
			pricePerLbMax: 6.5,
			stockedFilter: true,
			wholesaleOnly: true,
			stockedDays: 14
		});
	});

	it('does not force stocked-only catalog matches when criteria omit stocked_only', () => {
		expect(
			sourcingBriefCriteriaToCatalogSearchOptions(
				validateSourcingBriefCriteria({ country: 'Colombia', max_price_per_lb: 6.5 })
			)
		).toMatchObject({
			country: 'Colombia',
			pricePerLbMax: 6.5,
			stockedFilter: null,
			wholesaleOnly: false
		});
	});
});
