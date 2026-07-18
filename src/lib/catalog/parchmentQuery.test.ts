import { describe, expect, it } from 'vitest';
import { toParchmentCatalogQuery } from './parchmentQuery';

describe('Parchment catalog query adapter', () => {
	it('maps every app-owned filter and sort alias to the canonical SDK contract', () => {
		expect(
			toParchmentCatalogQuery({
				page: '2',
				limit: '15',
				name: 'guji',
				country: ['Ethiopia', 'Kenya'],
				cultivar_detail: 'Gesha',
				score_value_min: '86',
				score_value_max: '90',
				price_per_lb_min: '7.25',
				price_per_lb_max: '8.5',
				arrival_date: '2026-03-01',
				stocked_date: '2026-04-01',
				stocked_days: '30',
				sortField: 'score_value',
				sortDirection: 'asc',
				ids: [5, 9],
				processing_base_method: 'washed'
			})
		).toEqual({
			page: '2',
			limit: '15',
			name: 'guji',
			country: ['Ethiopia', 'Kenya'],
			processing_base_method: 'washed',
			variety: 'Gesha',
			scoreValueMin: '86',
			scoreValueMax: '90',
			pricePerLbMin: '7.25',
			pricePerLbMax: '8.5',
			arrivalDate: '2026-03-01',
			stockedDate: '2026-04-01',
			stockedDays: '30',
			sort: 'score_value',
			order: 'asc',
			coffeeIds: '5,9'
		});
	});

	it('prefers an explicit canonical param over a compatibility alias', () => {
		expect(
			toParchmentCatalogQuery({ stockedDate: '2026-05-01', stocked_date: '2026-04-01' })
		).toEqual({ stockedDate: '2026-05-01' });
	});

	it('normalizes canonical repeated coffee IDs to the scalar list contract', () => {
		expect(toParchmentCatalogQuery({ coffeeIds: ['5', '9'] })).toEqual({ coffeeIds: '5,9' });
	});
});
