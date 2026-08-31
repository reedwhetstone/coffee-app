import { describe, expect, it } from 'vitest';
import { describeSourcingBriefCriteria } from './sourcingBriefPresentation';

describe('describeSourcingBriefCriteria', () => {
	it('formats canonical typed criteria as presentation copy', () => {
		expect(
			describeSourcingBriefCriteria({
				version: 1,
				country: 'Colombia',
				region: 'Huila',
				processing: 'Washed',
				processing_base_method: 'washed',
				max_price_per_lb: 6.25,
				stocked_only: true,
				wholesale_only: true,
				stocked_days: 30
			})
		).toBe(
			'origin Colombia, region Huila, process Washed, base process washed, max $6.25/lb, stocked only, wholesale only, stocked in the last 30 days'
		);
	});

	it('does not perform criteria validation or normalization', () => {
		expect(describeSourcingBriefCriteria({ version: 1 })).toBe('open criteria');
	});
});
