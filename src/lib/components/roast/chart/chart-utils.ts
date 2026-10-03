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
		// A stretch of missing readings is not the series' sampling interval.
		if (points[index].gapBefore) continue;
		maxGap = Math.max(maxGap, points[index].timeMinutes - points[index - 1].timeMinutes);
	}
	return maxGap > 0 ? maxGap / 2 : Number.POSITIVE_INFINITY;
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

/** Artisan writes -1 where a probe has no reading; older imports stored it as a measurement. */
export const MISSING_READING = -1;

/** No value at all: the sample exists but nothing was recorded for this channel. */
export function isAbsentReading(value: number | null | undefined): boolean {
	return value === null || value === undefined || !Number.isFinite(value);
}

/** A temperature sample with no real reading behind it. */
export function isMissingReading(value: number | null | undefined): boolean {
	return isAbsentReading(value) || value === MISSING_READING;
}

/**
 * Keep only real readings. The first reading after a missing stretch is flagged so the
 * line breaks there instead of being drawn through a value nobody measured.
 */
export function realReadings(
	samples: Array<{ timeMinutes: number; value: number | null | undefined }>,
	isMissing: (value: number | null | undefined) => boolean = isMissingReading
): ChartPoint[] {
	const points: ChartPoint[] = [];
	let missing = false;
	for (const sample of samples) {
		if (isMissing(sample.value)) {
			missing = true;
			continue;
		}
		const point: ChartPoint = { timeMinutes: sample.timeMinutes, value: sample.value as number };
		if (missing && points.length > 0) point.gapBefore = true;
		points.push(point);
		missing = false;
	}
	return points;
}

/** Split a series into the runs of consecutive readings that should be drawn as one line. */
export function lineSegments(points: ChartPoint[]): ChartPoint[][] {
	const segments: ChartPoint[][] = [];
	for (const point of points) {
		if (point.gapBefore || segments.length === 0) segments.push([]);
		segments[segments.length - 1].push(point);
	}
	return segments;
}

const MILESTONE_LABELS: Record<string, string> = {
	charge: 'Charge',
	start: 'Start',
	tp: 'Turning point',
	turning_point: 'Turning point',
	dry_end: 'Dry end',
	maillard: 'Maillard',
	fc_start: 'First crack',
	first_crack: 'First crack',
	first_crack_start: 'First crack',
	fc_end: 'First crack end',
	first_crack_end: 'First crack end',
	sc_start: 'Second crack',
	second_crack: 'Second crack',
	second_crack_start: 'Second crack',
	sc_end: 'Second crack end',
	second_crack_end: 'Second crack end',
	drop: 'Drop',
	cool: 'Cool',
	cool_end: 'Cool end',
	end: 'End'
};

/** Short readable name for a roast milestone, e.g. `dry_end` becomes "Dry end". */
export function milestoneLabel(name: string): string {
	const key = name
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	const known = MILESTONE_LABELS[key];
	if (known) return known;
	const words = name.trim().replace(/_+/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface MarkerLabelPlacement {
	row: number;
	anchor: 'start' | 'end';
}

const MARKER_CHARACTER_WIDTH = 6.2;
const MARKER_LABEL_OFFSET = 4;
const MARKER_LABEL_SPACING = 6;

/**
 * Place horizontal marker labels beside their lines, moving a label down a row
 * whenever it would run into one already placed.
 */
export function layoutMarkerLabels<Marker extends { x: number; label: string }>(
	markers: Marker[],
	width: number
): Array<Marker & MarkerLabelPlacement> {
	const rows: Array<Array<[number, number]>> = [];
	return markers
		.map((marker, index) => ({ marker, index }))
		.sort((left, right) => left.marker.x - right.marker.x || left.index - right.index)
		.map(({ marker }) => {
			const textWidth = marker.label.length * MARKER_CHARACTER_WIDTH;
			const anchor: 'start' | 'end' =
				marker.x + MARKER_LABEL_OFFSET + textWidth > width &&
				marker.x - MARKER_LABEL_OFFSET - textWidth >= 0
					? 'end'
					: 'start';
			const from =
				anchor === 'start'
					? marker.x + MARKER_LABEL_OFFSET
					: marker.x - MARKER_LABEL_OFFSET - textWidth;
			const to = from + textWidth;
			let row = rows.findIndex((taken) =>
				taken.every(
					([start, end]) => to + MARKER_LABEL_SPACING <= start || from >= end + MARKER_LABEL_SPACING
				)
			);
			if (row === -1) row = rows.push([]) - 1;
			rows[row].push([from, to]);
			return { ...marker, row, anchor };
		});
}
