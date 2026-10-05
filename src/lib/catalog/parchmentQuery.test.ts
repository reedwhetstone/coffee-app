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
				elevation_min_masl: '1200',
				elevation_max_masl: '1900',
				include_unknown_elevation: 'true',
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
			elevationMinMasl: '1200',
			elevationMaxMasl: '1900',
			includeUnknownElevation: 'true',
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

	it('maps the grade and quality filters to the canonical SDK contract', () => {
		expect(
			toParchmentCatalogQuery({
				grade_code: ['KE:AA', 'PREP:EP'],
				peaberry: 'true',
				lab_analyzed: 'true',
				screen_min: 15,
				screen_max: 18,
				include_unknown_screen: 'true',
				moisture_max: 11.5,
				score_protocol: 'sca_2004'
			})
		).toEqual({
			gradeCode: ['KE:AA', 'PREP:EP'],
			peaberry: 'true',
			labAnalyzed: 'true',
			screenMin: 15,
			screenMax: 18,
			includeUnknownScreen: 'true',
			moistureMax: 11.5,
			scoreProtocol: 'sca_2004'
		});
	});
});
