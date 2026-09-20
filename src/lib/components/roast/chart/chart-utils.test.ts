import { describe, expect, it } from 'vitest';
import type { ChartSeries } from './chart-types';
import { controlScaleDomain, nearestPointWithinSamplingGap } from './chart-utils';

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
});
