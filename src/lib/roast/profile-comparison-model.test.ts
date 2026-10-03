import { describe, expect, it } from 'vitest';
import {
	buildProfileComparisonChart,
	describeMilestoneTimings,
	formatDuration,
	type ProfileComparison
} from './profile-comparison-model';

type Series = ProfileComparison['series'][number];

function comparisonOf(
	series: Series[],
	milestones: ProfileComparison['milestones'] = [],
	targetUnit: 'F' | 'C' = 'F'
): ProfileComparison {
	return {
		alignment: 'charge',
		targetUnit,
		left: { type: 'executed_roast', id: 'left', revision: 'left-revision' },
		right: { type: 'reference_profile', id: 'right', revision: 'right-revision' },
		series,
		milestones
	} as ProfileComparison;
}

function temperatureSeries(
	kind: 'bean_temperature' | 'environmental_temperature',
	values: Array<[left: number, right: number]>
): Series {
	return {
		id: kind === 'bean_temperature' ? 'bean-temperature' : 'environmental-temperature',
		name: kind === 'bean_temperature' ? 'BT' : 'ET',
		kind,
		unit: 'F',
		points: values.map(([left, right], index) => ({
			timeMilliseconds: index * 2_000,
			left,
			right,
			delta: right - left
		}))
	};
}

const milestone = (name: string, leftMilliseconds: number, rightMilliseconds: number) => ({
	name,
	leftMilliseconds,
	rightMilliseconds,
	deltaMilliseconds: rightMilliseconds - leftMilliseconds
});

describe('profile comparison chart model', () => {
	it('labels the two profiles A and B and keeps their measurements unchanged', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([temperatureSeries('bean_temperature', [[200, 210]])])
		);

		expect(chart.series.map((series) => series.label)).toEqual(['A · BT', 'B · BT']);
		expect(chart.series[0].dashed).not.toBe(true);
		expect(chart.series[1].dashed).toBe(true);
		expect(chart.series[0].points).toEqual([{ timeMinutes: 0, value: 200 }]);
		expect(chart.series[1].points).toEqual([{ timeMinutes: 0, value: 210 }]);
	});

	it('marks milestones with short labels, solid for A and dashed for B', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf(
				[temperatureSeries('bean_temperature', [[200, 210]])],
				[milestone('charge', 0, 0), milestone('dry_end', 300_000, 255_000)]
			)
		);

		expect(
			chart.events.map(({ timeMinutes, label, dashed }) => ({ timeMinutes, label, dashed }))
		).toEqual([
			{ timeMinutes: 0, label: 'Charge', dashed: undefined },
			{ timeMinutes: 5, label: 'A Dry end', dashed: false },
			{ timeMinutes: 4.25, label: 'B Dry end', dashed: true }
		]);
	});

	it('keeps rate-of-rise series on the secondary RoR axis', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				{
					id: 'ror',
					name: 'RoR',
					kind: 'rate_of_rise',
					unit: 'F/min',
					points: [{ timeMilliseconds: 60_000, left: 12, right: 10, delta: 2 }]
				}
			])
		);

		expect(chart.series.map((series) => series.axis)).toEqual(['ror', 'ror']);
		expect(chart.rorPoints).toEqual([{ timeMinutes: 1, value: 12 }]);
	});

	it('leaves out a channel that has no real readings on either profile', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('bean_temperature', [
					[300, 310],
					[305, 315]
				]),
				temperatureSeries('environmental_temperature', [
					[-1, -1],
					[-1, -1]
				])
			])
		);

		expect(chart.series.map((series) => series.id)).toEqual([
			'left-bean-temperature',
			'right-bean-temperature'
		]);
		expect(chart.envTempPoints).toEqual([]);
		expect(chart.yTempDomain[0]).toBeGreaterThan(200);
	});

	it('keeps the profile that has readings when only the other one is missing a channel', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('environmental_temperature', [
					[400, -1],
					[410, -1]
				])
			])
		);

		expect(chart.series.map((series) => series.label)).toEqual(['A · ET']);
	});

	it('draws a missing reading as a gap instead of a dip toward -1', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('bean_temperature', [
					[300, 300],
					[302, 302],
					[-1, 304],
					[306, 306],
					[308, 308]
				])
			])
		);

		expect(chart.series[0].points).toEqual([
			{ timeMinutes: 0, value: 300 },
			{ timeMinutes: 2 / 60, value: 302 },
			{ timeMinutes: 6 / 60, value: 306, gapBefore: true },
			{ timeMinutes: 8 / 60, value: 308 }
		]);
		expect(chart.series[1].points).toHaveLength(5);
		expect(chart.yTempDomain[0]).toBeGreaterThan(200);
	});

	it('recognises the marker after Parchment converts a Celsius profile to Fahrenheit', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('environmental_temperature', [
					[30.2, 400],
					[30.2, 410]
				])
			])
		);

		expect(chart.series.map((series) => series.label)).toEqual(['B · ET']);
	});

	it('removes readings interpolated toward a missing marker on the resampled profile', () => {
		// The stored -1 fell between two sample times, so no point carries the marker itself.
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('bean_temperature', [
					[300, 300],
					[302, 302],
					[304, 151],
					[306, 62],
					[308, 308],
					[310, 310],
					[312, 312]
				])
			])
		);

		const resampled = chart.series.find((series) => series.id === 'right-bean-temperature');
		expect(resampled?.points.map((point) => point.value)).toEqual([300, 302, 308, 310, 312]);
		expect(resampled?.points[2].gapBefore).toBe(true);
		expect(chart.yTempDomain[0]).toBeGreaterThan(200);
	});

	it('never filters the first profile, whose readings are not interpolated', () => {
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('bean_temperature', [
					[300, 300],
					[302, 302],
					[151, 304],
					[62, 306],
					[308, 308],
					[310, 310],
					[312, 312]
				])
			])
		);

		expect(chart.series[0].points.map((point) => point.value)).toEqual([
			300, 302, 151, 62, 308, 310, 312
		]);
	});

	it('keeps the whole timeline, and charge, when a comparison starts and ends without readings', () => {
		const readings = [-1, -1, 300, 310, -1, -1];
		const chart = buildProfileComparisonChart(
			comparisonOf(
				[
					{
						id: 'bean-temperature',
						name: 'BT',
						kind: 'bean_temperature',
						unit: 'F',
						points: readings.map((value, index) => ({
							timeMilliseconds: index * 120_000,
							left: value,
							right: value,
							delta: 0
						}))
					}
				],
				[milestone('charge', 0, 0), milestone('drop', 600_000, 600_000)]
			)
		);

		expect(chart.series[0].points.map((point) => point.timeMinutes)).toEqual([4, 6]);
		expect(chart.xDomain[0]).toBeLessThanOrEqual(0);
		expect(chart.xDomain[1]).toBeGreaterThanOrEqual(10);
		expect(
			chart.events.every(
				(event) => event.timeMinutes >= chart.xDomain[0] && event.timeMinutes <= chart.xDomain[1]
			)
		).toBe(true);
	});

	it('keeps a real fast temperature drop on the resampled profile', () => {
		const falling = [400, 340, 280, 230, 200, 190, 195, 205, 220].map((value): [number, number] => [
			value,
			value
		]);
		const chart = buildProfileComparisonChart(
			comparisonOf([temperatureSeries('bean_temperature', falling)])
		);

		expect(chart.series[1].points.map((point) => point.value)).toEqual(
			falling.map(([value]) => value)
		);
	});

	it('keeps the steep fall after charge even when another channel carries the marker', () => {
		const falling = [400, 340, 280, 230, 200, 190, 195, 205, 220].map((value): [number, number] => [
			value,
			value
		]);
		const chart = buildProfileComparisonChart(
			comparisonOf([
				temperatureSeries('bean_temperature', falling),
				temperatureSeries('environmental_temperature', [[-1, -1]])
			])
		);

		expect(chart.series[1].points.map((point) => point.value)).toEqual(
			falling.map(([value]) => value)
		);
	});
});

describe('milestone timing in plain words', () => {
	it('says which profile reached each milestone earlier or later, and by how much', () => {
		const timings = describeMilestoneTimings(
			comparisonOf(
				[],
				[
					milestone('charge', 0, 0),
					milestone('turning_point', 60_000, 68_200),
					milestone('dry_end', 300_000, 255_000),
					milestone('fc_start', 480_000, 480_200),
					milestone('drop', 720_000, 498_500)
				]
			)
		);

		expect(timings).toEqual([
			{
				name: 'turning_point',
				label: 'Turning point',
				leftTime: '1:00',
				rightTime: '1:08',
				difference: 'B was 8.2 sec later'
			},
			{
				name: 'dry_end',
				label: 'Dry end',
				leftTime: '5:00',
				rightTime: '4:15',
				difference: 'B was 45 sec earlier'
			},
			{
				name: 'fc_start',
				label: 'First crack',
				leftTime: '8:00',
				rightTime: '8:00',
				difference: 'Same time'
			},
			{
				name: 'drop',
				label: 'Drop',
				leftTime: '12:00',
				rightTime: '8:19',
				difference: 'B was 3 min 42 sec earlier'
			}
		]);
	});

	it('uses seconds below a minute and minutes above it', () => {
		expect(formatDuration(8_200)).toBe('8.2 sec');
		expect(formatDuration(-45_000)).toBe('45 sec');
		expect(formatDuration(120_000)).toBe('2 min');
		expect(formatDuration(221_500)).toBe('3 min 42 sec');
	});
});
