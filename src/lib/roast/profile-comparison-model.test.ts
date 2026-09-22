import { describe, expect, it } from 'vitest';
import { buildProfileComparisonChart, type ProfileComparison } from './profile-comparison-model';

describe('profile comparison chart model', () => {
	it('uses shared chart semantics with distinct reference labels and immutable measurements', () => {
		const comparison = {
			alignment: 'charge',
			targetUnit: 'F',
			series: [
				{
					id: 'bean-temperature',
					name: 'BT',
					kind: 'bean_temperature',
					unit: 'F',
					points: [{ timeMilliseconds: 60_000, left: 200, right: 210, delta: -10 }]
				}
			],
			milestones: [
				{
					name: 'first_crack',
					leftMilliseconds: 480_000,
					rightMilliseconds: 500_000,
					deltaMilliseconds: -20_000
				}
			]
		} as ProfileComparison;

		const chart = buildProfileComparisonChart(comparison, 'Executed roast', 'Reference plan');

		expect(chart.series.map((series) => series.label)).toEqual([
			'Executed roast · BT',
			'Reference plan · BT'
		]);
		expect(chart.series[0].dashed).not.toBe(true);
		expect(chart.series[1].dashed).toBe(true);
		expect(chart.events).toEqual([
			{ timeMinutes: 8, name: 'Executed roast: first_crack' },
			{ timeMinutes: 500_000 / 60_000, name: 'Reference plan: first_crack' }
		]);
	});
});
