import { describe, expect, it } from 'vitest';
import type { components } from '@purveyors/sdk';
import { buildProfileGenerationChart } from './profile-generation-model';

type Chart = components['schemas']['ReferenceProfileChart'];

describe('planned reference preview chart', () => {
	it('keeps the parent visually distinct and preserves unchanged events and zero samples', () => {
		const parent: Chart = {
			temperatureUnit: 'F',
			chargeTimeMilliseconds: 0,
			series: [
				{
					id: 'bt',
					name: 'BT',
					kind: 'bean_temperature',
					unit: 'F',
					deviceIndex: 0,
					channel: 2,
					points: [
						{ timeMilliseconds: 0, value: 0 },
						{ timeMilliseconds: 60_000, value: 200 }
					]
				}
			],
			events: [
				{ timeMilliseconds: 120_000, name: 'First crack', value: null, category: 'milestone' }
			]
		};
		const preview: Chart = {
			...parent,
			series: [
				{
					...parent.series[0],
					points: [
						{ timeMilliseconds: 0, value: 0 },
						{ timeMilliseconds: 60_000, value: 205 }
					]
				}
			]
		};
		const chart = buildProfileGenerationChart(parent, preview);
		expect(chart.series.map((series) => [series.label, series.dashed])).toEqual([
			['Parent · BT', true],
			['Proposed · BT', false]
		]);
		expect(chart.series[0].points).toEqual([
			{ timeMinutes: 0, value: 0 },
			{ timeMinutes: 1, value: 200 }
		]);
		expect(chart.series[1].points[1].value).toBe(205);
		expect(chart.events).toEqual([{ timeMinutes: 2, name: 'First crack' }]);
	});
});
