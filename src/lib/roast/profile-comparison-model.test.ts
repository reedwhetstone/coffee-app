import { describe, expect, it } from 'vitest';
import { buildProfileComparisonChart, type ProfileComparison } from './profile-comparison-model';

describe('profile comparison chart model', () => {
	it('uses shared chart semantics with distinct reference labels and immutable measurements', () => {
		const comparison = {
			alignment: 'charge',
			targetUnit: 'F',
			left: { type: 'executed_roast', id: 'left', revision: 'left-revision' },
			right: { type: 'reference_profile', id: 'right', revision: 'right-revision' },
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

	it('keeps rate-of-rise series on the secondary RoR axis', () => {
		const comparison = {
			alignment: 'charge',
			targetUnit: 'F',
			left: { type: 'executed_roast', id: 'left', revision: 'left-revision' },
			right: { type: 'reference_profile', id: 'right', revision: 'right-revision' },
			series: [
				{
					id: 'ror',
					name: 'RoR',
					kind: 'rate_of_rise',
					unit: 'F/min',
					points: [{ timeMilliseconds: 60_000, left: 12, right: 10, delta: 2 }]
				}
			],
			milestones: []
		} as ProfileComparison;

		const chart = buildProfileComparisonChart(comparison, 'Left', 'Right');

		expect(chart.series.map((series) => series.axis)).toEqual(['ror', 'ror']);
		expect(chart.rorPoints).toEqual([{ timeMinutes: 1, value: 12 }]);
	});
});
