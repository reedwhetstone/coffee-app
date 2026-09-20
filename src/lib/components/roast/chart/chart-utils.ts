import { bisector } from 'd3-array';
import type { ChartPoint, ChartSeries } from './chart-types';

const bisectTime = bisector<ChartPoint, number>((point) => point.timeMinutes);

export function nearestPoint(points: ChartPoint[], time: number): ChartPoint | null {
	const index = bisectTime.left(points, time);
	const left = points[index - 1];
	const right = points[index];
	return left && right
		? time - left.timeMinutes > right.timeMinutes - time
			? right
			: left
		: (left ?? right ?? null);
}

function samplingTolerance(points: ChartPoint[]): number {
	if (points.length < 2) return Number.POSITIVE_INFINITY;
	let maxGap = 0;
	for (let index = 1; index < points.length; index += 1) {
		maxGap = Math.max(maxGap, points[index].timeMinutes - points[index - 1].timeMinutes);
	}
	return maxGap / 2;
}

/** Return the nearest independent-sample value when it is within that series' sampling gap. */
export function nearestPointWithinSamplingGap(
	points: ChartPoint[],
	time: number
): ChartPoint | null {
	const point = nearestPoint(points, time);
	if (!point) return null;
	return Math.abs(point.timeMinutes - time) <= samplingTolerance(points) ? point : null;
}

/** Keep the established 0-based control scale while extending it below zero when needed. */
export function controlScaleDomain(series: ChartSeries[]): [number, number] {
	const values = series
		.filter((entry) => entry.axis === 'control')
		.flatMap((entry) => entry.points.map((point) => point.value));
	if (values.length === 0) return [0, 10];

	const minimum = Math.min(...values);
	const maximum = Math.max(...values);
	const lower = minimum < 0 ? Math.floor(minimum) : 0;
	let upper =
		maximum <= 10 ? 10 : maximum <= 50 ? 50 : maximum <= 100 ? 100 : Math.ceil(maximum / 100) * 100;
	if (upper <= lower) upper = lower + 1;
	return [lower, upper];
}
