import type { components } from '@purveyors/sdk';
import type { ChartEvent, ChartSeries, ProcessedChartData } from '$lib/components/roast/chart';
import {
	MISSING_READING,
	isAbsentReading,
	milestoneLabel,
	realReadings
} from '$lib/components/roast/chart/chart-utils';

type SdkProfileComparison = components['schemas']['ProfileComparisonResponse']['data'];
type ProfileComparisonSeries =
	| SdkProfileComparison['series'][number]
	| (Omit<SdkProfileComparison['series'][number], 'kind'> & { kind: 'rate_of_rise' });

export type ProfileComparison = Omit<SdkProfileComparison, 'series'> & {
	series: ProfileComparisonSeries[];
};

/** The two compared profiles are always named A (first, solid) and B (second, dashed). */
export const COMPARISON_SIDES = { left: 'A', right: 'B' } as const;

const LEFT_COLORS = ['#b45309', '#0f766e', '#7c3aed', '#0891b2'];
const RIGHT_COLORS = ['#dc2626', '#2563eb', '#be185d', '#4f46e5'];
const MARKER_COLOR = '#57534e';
const SAME_TIME_MILLISECONDS = 500;
const DROPOUT_WINDOW = 4;

type Side = 'left' | 'right';
type Reading = number | null;

function domain(values: number[], fallback: [number, number]): [number, number] {
	if (values.length === 0) return fallback;
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (min === max) return [min - 1, max + 1];
	const padding = (max - min) * 0.08;
	return [Math.floor(min - padding), Math.ceil(max + padding)];
}

function median(values: number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * The -1 "no reading" marker as it appears after Parchment converts a comparison to the
 * target unit: unchanged for a profile already in that unit, converted for the other one.
 */
function missingReadingValues(targetUnit: 'F' | 'C'): number[] {
	return [
		MISSING_READING,
		targetUnit === 'F' ? MISSING_READING * (9 / 5) + 32 : (MISSING_READING - 32) * (5 / 9)
	];
}

/**
 * Parchment resamples the second profile by interpolation, so a stored -1 becomes a
 * reading partway between -1 and its real neighbours. Remove readings that sit far
 * below the readings around them. A steady climb or fall never qualifies, because
 * each of its readings is the middle value of its own neighbourhood.
 */
function withoutDropouts(values: Reading[], minimumDepth: number): Reading[] {
	return values.map((value, index) => {
		if (value === null) return null;
		const nearby = values
			.slice(Math.max(0, index - DROPOUT_WINDOW), index + DROPOUT_WINDOW + 1)
			.filter((entry): entry is number => entry !== null);
		if (nearby.length < 3) return value;
		const middle = median(nearby);
		const spread = median(nearby.map((entry) => Math.abs(entry - middle)));
		return middle - value > Math.max(3 * 1.4826 * spread, minimumDepth) ? null : value;
	});
}

/** Adapt Parchment's measured comparison to the same chart renderer used by executed roasts. */
export function buildProfileComparisonChart(comparison: ProfileComparison): ProcessedChartData {
	const missingValues = missingReadingValues(comparison.targetUnit);
	const isMarker = (value: number) =>
		missingValues.some((missing) => Math.abs(value - missing) < 1e-6);
	const axisFor = (entry: ProfileComparisonSeries): ChartSeries['axis'] =>
		entry.kind === 'rate_of_rise'
			? 'ror'
			: entry.kind === 'auxiliary' && !/[cf]$/i.test(entry.unit)
				? 'control'
				: 'temperature';
	// Only stored data that still carries the marker can contain interpolated dropouts.
	const hasMarker = comparison.series.some(
		(entry) =>
			axisFor(entry) === 'temperature' &&
			entry.points.some((point) => isMarker(point.left) || isMarker(point.right))
	);
	const minimumDropoutDepth = comparison.targetUnit === 'C' ? 8 : 15;

	const series: ChartSeries[] = comparison.series.flatMap((entry, index) => {
		const axis = axisFor(entry);
		const shared = {
			kind: entry.kind,
			unit: entry.unit === comparison.targetUnit ? `°${entry.unit}` : entry.unit,
			axis,
			strokeWidth: entry.kind === 'bean_temperature' ? 3 : 2,
			curve: axis === 'control' ? ('linear' as const) : ('basis' as const)
		};
		const readings = (side: Side) => {
			let values: Reading[] = entry.points.map((point) => {
				const value = point[side];
				return isAbsentReading(value) || (axis === 'temperature' && isMarker(value)) ? null : value;
			});
			if (axis === 'temperature' && hasMarker)
				values = withoutDropouts(values, minimumDropoutDepth);
			return realReadings(
				entry.points.map((point, pointIndex) => ({
					timeMinutes: point.timeMilliseconds / 60_000,
					value: values[pointIndex]
				})),
				(value) => value === null || value === undefined
			);
		};
		const candidates: ChartSeries[] = [
			{
				...shared,
				id: `left-${entry.id}`,
				label: `${COMPARISON_SIDES.left} · ${entry.name}`,
				color: LEFT_COLORS[index % LEFT_COLORS.length],
				points: readings('left')
			},
			{
				...shared,
				id: `right-${entry.id}`,
				label: `${COMPARISON_SIDES.right} · ${entry.name}`,
				color: RIGHT_COLORS[index % RIGHT_COLORS.length],
				dashed: true,
				points: readings('right')
			}
		];
		// A channel with no real readings, such as a probe that was never connected, is left out.
		return candidates.filter((candidate) => candidate.points.length > 0);
	});
	const times = series.flatMap((entry) => entry.points.map((point) => point.timeMinutes));
	const temperatures = series
		.filter((entry) => entry.axis === 'temperature')
		.flatMap((entry) => entry.points.map((point) => point.value));
	const temperatureUnit = `°${comparison.targetUnit}`;
	return {
		temperaturePoints: series.find((entry) => entry.kind === 'bean_temperature')?.points ?? [],
		envTempPoints: series.find((entry) => entry.kind === 'environmental_temperature')?.points ?? [],
		rorPoints: series.find((entry) => entry.kind === 'rate_of_rise')?.points ?? [],
		controlSeries: [],
		series,
		events: comparison.milestones.flatMap((milestone): ChartEvent[] => {
			const label = milestoneLabel(milestone.name);
			// Both curves start at charge, so one marker covers both profiles.
			if (milestone.leftMilliseconds === milestone.rightMilliseconds) {
				return [
					{
						timeMinutes: milestone.leftMilliseconds / 60_000,
						name: milestone.name,
						label,
						color: MARKER_COLOR
					}
				];
			}
			return [
				{
					timeMinutes: milestone.leftMilliseconds / 60_000,
					name: milestone.name,
					label: `${COMPARISON_SIDES.left} ${label}`,
					color: MARKER_COLOR,
					dashed: false
				},
				{
					timeMinutes: milestone.rightMilliseconds / 60_000,
					name: milestone.name,
					label: `${COMPARISON_SIDES.right} ${label}`,
					color: MARKER_COLOR,
					dashed: true
				}
			];
		}),
		chargeTime: 0,
		temperatureUnit,
		xDomain: domain(times, [0, 12]),
		yTempDomain: domain(temperatures, comparison.targetUnit === 'C' ? [0, 260] : [100, 500]),
		yRorDomain: [0, comparison.targetUnit === 'C' ? 30 : 50]
	};
}

function clock(milliseconds: number): string {
	const totalSeconds = Math.round(Math.abs(milliseconds) / 1000);
	const seconds = String(totalSeconds % 60).padStart(2, '0');
	return `${milliseconds < 0 ? '-' : ''}${Math.floor(totalSeconds / 60)}:${seconds}`;
}

/** A length of time in everyday units, such as "8.2 sec" or "3 min 42 sec". */
export function formatDuration(milliseconds: number): string {
	const seconds = Math.abs(milliseconds) / 1000;
	if (seconds < 10) return `${Number(seconds.toFixed(1))} sec`;
	const whole = Math.round(seconds);
	if (whole < 60) return `${whole} sec`;
	const remainder = whole % 60;
	return remainder === 0
		? `${Math.floor(whole / 60)} min`
		: `${Math.floor(whole / 60)} min ${remainder} sec`;
}

export interface MilestoneTiming {
	name: string;
	label: string;
	/** Time from charge, as m:ss. */
	leftTime: string;
	rightTime: string;
	/** Plain statement of which profile reached the milestone first, and by how much. */
	difference: string;
}

/** Milestone timing as sentences: when each profile reached it and which one was earlier. */
export function describeMilestoneTimings(comparison: ProfileComparison): MilestoneTiming[] {
	return comparison.milestones
		.filter((milestone) => milestone.leftMilliseconds !== 0 || milestone.rightMilliseconds !== 0)
		.map((milestone) => {
			// Parchment reports the second profile's time minus the first profile's time.
			const delta = milestone.rightMilliseconds - milestone.leftMilliseconds;
			return {
				name: milestone.name,
				label: milestoneLabel(milestone.name),
				leftTime: clock(milestone.leftMilliseconds),
				rightTime: clock(milestone.rightMilliseconds),
				difference:
					Math.abs(delta) < SAME_TIME_MILLISECONDS
						? 'Same time'
						: `${COMPARISON_SIDES.right} was ${formatDuration(delta)} ${delta < 0 ? 'earlier' : 'later'}`
			};
		});
}
