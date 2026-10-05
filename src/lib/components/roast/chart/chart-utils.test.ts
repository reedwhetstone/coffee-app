import { describe, expect, it } from 'vitest';
import type { ChartSeries } from './chart-types';
import {
	controlScaleDomain,
	isMissingReading,
	layoutMarkerLabels,
	lineSegments,
	milestoneKey,
	milestoneLabel,
	nearestPointWithinSamplingGap,
	realReadings
} from './chart-utils';

function controlSeries(values: number[]): ChartSeries {
	return {
		id: 'control-fan',
		label: 'fan',
		kind: 'control',
		unit: null,
		axis: 'control',
		color: '#000',
		strokeWidth: 2,
		curve: 'stepAfter',
		points: values.map((value, index) => ({ timeMinutes: index, value }))
	};
}

describe('chart utilities', () => {
	it('extends the control scale below zero for negative auxiliary readings', () => {
		expect(controlScaleDomain([controlSeries([-8, -2])])).toEqual([-8, 10]);
	});

	it('uses each series sampling gap for sparse tooltip values', () => {
		const points = [
			{ timeMinutes: 0, value: 10 },
			{ timeMinutes: 2, value: 20 }
		];

		expect(nearestPointWithinSamplingGap(points, 1)).toEqual({ timeMinutes: 0, value: 10 });
		expect(nearestPointWithinSamplingGap(points, -1.1)).toBeNull();
	});

	it('treats null and the -1 marker as missing, and keeps a real zero', () => {
		expect([null, undefined, Number.NaN, -1].map(isMissingReading)).toEqual([
			true,
			true,
			true,
			true
		]);
		expect([0, -0.5, 212].map(isMissingReading)).toEqual([false, false, false]);
	});

	it('drops missing readings and flags the reading that follows a gap', () => {
		const points = realReadings([
			{ timeMinutes: 0, value: -1 },
			{ timeMinutes: 1, value: 200 },
			{ timeMinutes: 2, value: null },
			{ timeMinutes: 3, value: -1 },
			{ timeMinutes: 4, value: 230 },
			{ timeMinutes: 5, value: 240 }
		]);

		expect(points).toEqual([
			{ timeMinutes: 1, value: 200, gapBefore: true },
			{ timeMinutes: 4, value: 230, gapBefore: true },
			{ timeMinutes: 5, value: 240 }
		]);
		expect(lineSegments(points).map((segment) => segment.map((point) => point.value))).toEqual([
			[200],
			[230, 240]
		]);
	});

	it('returns no points for a channel that never had a reading', () => {
		expect(realReadings([0, 1, 2].map((timeMinutes) => ({ timeMinutes, value: -1 })))).toEqual([]);
		expect(lineSegments([])).toEqual([]);
	});

	it('does not read a value across a stretch of missing readings', () => {
		const points = realReadings([
			{ timeMinutes: 0, value: 200 },
			{ timeMinutes: 0.1, value: 202 },
			{ timeMinutes: 0.2, value: -1 },
			{ timeMinutes: 2, value: 260 },
			{ timeMinutes: 2.1, value: 262 }
		]);

		expect(nearestPointWithinSamplingGap(points, 1)).toBeNull();
		expect(nearestPointWithinSamplingGap(points, 2.04)).toMatchObject({ value: 260 });
	});

	it('reports a reading only at its own time when every interval is a gap', () => {
		const points = realReadings([
			{ timeMinutes: 0, value: 200 },
			{ timeMinutes: 1, value: -1 },
			{ timeMinutes: 2, value: 220 },
			{ timeMinutes: 3, value: -1 },
			{ timeMinutes: 4, value: 240 }
		]);

		expect(nearestPointWithinSamplingGap(points, 2)).toMatchObject({ value: 220 });
		// The missing samples, and everywhere else between two readings, report nothing.
		expect([1, 3, 0.2, 2.4, 9].map((time) => nearestPointWithinSamplingGap(points, time))).toEqual([
			null,
			null,
			null,
			null,
			null
		]);
	});

	it('reports a lone reading only at its own time when the readings beside it are missing', () => {
		const samples = (values: number[]) =>
			values.map((value, timeMinutes) => ({ timeMinutes, value }));
		const afterGap = realReadings(samples([-1, -1, 300]));
		const beforeGap = realReadings(samples([300, -1, -1]));

		expect(afterGap).toEqual([{ timeMinutes: 2, value: 300, gapBefore: true }]);
		expect(beforeGap).toEqual([{ timeMinutes: 0, value: 300, gapAfter: true }]);
		expect(nearestPointWithinSamplingGap(afterGap, 2)).toMatchObject({ value: 300 });
		expect(nearestPointWithinSamplingGap(afterGap, 0)).toBeNull();
		expect(nearestPointWithinSamplingGap(beforeGap, 2)).toBeNull();
		// A series that only ever had one sample is still read anywhere.
		expect(nearestPointWithinSamplingGap([{ timeMinutes: 0, value: 300 }], 5)).toMatchObject({
			value: 300
		});
	});

	it('turns milestone codes into short readable names', () => {
		expect(
			['dry_end', 'turning_point', 'fc_start', 'First Crack', 'DROP', 'charge', 'cool end'].map(
				milestoneLabel
			)
		).toEqual([
			'Dry end',
			'Turning point',
			'First crack',
			'First crack',
			'Drop',
			'Charge',
			'Cool end'
		]);
		expect(milestoneLabel('yellowing_start')).toBe('Yellowing start');
	});

	it('gives a milestone one name however it was recorded', () => {
		expect(
			['fc_start', 'first_crack', 'First Crack', ' first-crack-start '].map(milestoneKey)
		).toEqual(['first_crack', 'first_crack', 'first_crack', 'first_crack']);
		expect(['tp', 'Turning Point'].map(milestoneKey)).toEqual(['turning_point', 'turning_point']);
		// Different milestones stay different, known or not.
		expect(
			['fc_start', 'fc_end', 'dry_end', 'maillard', 'Yellowing Start'].map(milestoneKey)
		).toEqual(['first_crack', 'first_crack_end', 'dry_end', 'maillard', 'yellowing_start']);
		// Two names with the same key always read the same.
		expect(milestoneLabel('sc_start')).toBe(milestoneLabel('Second Crack'));
	});

	it('moves a marker label to its own row instead of overlapping a neighbour', () => {
		const placed = layoutMarkerLabels(
			[
				{ x: 300, label: 'B Dry end' },
				{ x: 10, label: 'Charge' },
				{ x: 310, label: 'A Dry end' },
				{ x: 590, label: 'A Drop' }
			],
			600
		);

		expect(placed.map(({ label, row, anchor }) => ({ label, row, anchor }))).toEqual([
			{ label: 'Charge', row: 0, anchor: 'start' },
			{ label: 'B Dry end', row: 0, anchor: 'start' },
			{ label: 'A Dry end', row: 1, anchor: 'start' },
			{ label: 'A Drop', row: 0, anchor: 'end' }
		]);
	});
});
