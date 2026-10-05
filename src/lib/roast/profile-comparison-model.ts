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
 * reading partway between -1 and its real neighbours, and the marker itself is rarely
 * left in the result. Remove readings that sit far below the readings around them.
 * A steady climb or fall never qualifies, because each of its readings is the middle
 * value of its own neighbourhood.
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
			// Only the second profile is interpolated. The first keeps its stored readings, so
			// its marker is always found exactly and none of its real readings are filtered.
			if (axis === 'temperature' && side === 'right')
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
	// The time axis covers every sample, with or without a reading, so a comparison that
	// starts or ends on missing readings still shows charge and the milestones around it.
	const times = comparison.series.flatMap((entry) =>
		entry.points.map((point) => point.timeMilliseconds / 60_000)
	);
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

/** A milestone one profile recorded, timed from that profile's own charge. */
export interface SideMilestone {
	name: string;
	milliseconds: number;
}

/**
 * The milestones each compared profile recorded. Parchment's comparison lists only the
 * milestones both profiles have, so this is what shows a milestone that one of them lacks.
 * A side is null when its milestones could not be read.
 */
export interface ComparisonSideMilestones {
	left: SideMilestone[] | null;
	right: SideMilestone[] | null;
}

export const NOT_RECORDED = 'Not recorded';

export interface MilestoneTiming {
	name: string;
	label: string;
	/** Time from charge, as m:ss, or "Not recorded". */
	leftTime: string;
	rightTime: string;
	/** Plain statement of which profile reached the milestone first, and by how much. */
	difference: string;
	/** The profile that did not record this milestone, when only one of them did. */
	missing?: (typeof COMPARISON_SIDES)[Side];
}

const milestoneKey = (name: string) => name.trim().toLowerCase();

/** Charge is where both curves start, so it is never a difference. */
function isCharge(milestone: ProfileComparison['milestones'][number]): boolean {
	return milestone.leftMilliseconds === 0 && milestone.rightMilliseconds === 0;
}

/** Milestones that exactly one of the two profiles recorded, charge excepted. */
function oneSidedTimings(
	comparison: ProfileComparison,
	sides: ComparisonSideMilestones
): Array<MilestoneTiming & { at: number }> {
	if (!sides.left || !sides.right) return [];
	const shared = new Set(comparison.milestones.map((milestone) => milestoneKey(milestone.name)));
	const recorded = (entries: SideMilestone[]) =>
		new Map(entries.map((entry) => [milestoneKey(entry.name), entry]));
	const left = recorded(sides.left);
	const right = recorded(sides.right);
	const timings: Array<MilestoneTiming & { at: number }> = [];
	for (const [has, lacks, missing] of [
		[left, right, 'right'],
		[right, left, 'left']
	] as const) {
		for (const [key, entry] of has) {
			if (key === 'charge' || shared.has(key) || lacks.has(key)) continue;
			const label = milestoneLabel(entry.name);
			const time = clock(entry.milliseconds);
			timings.push({
				name: key,
				label,
				leftTime: missing === 'left' ? NOT_RECORDED : time,
				rightTime: missing === 'right' ? NOT_RECORDED : time,
				difference: `${label} not recorded for ${COMPARISON_SIDES[missing]}`,
				missing: COMPARISON_SIDES[missing],
				at: entry.milliseconds
			});
		}
	}
	return timings;
}

/**
 * Milestone timing as sentences: when each profile reached it and which one was earlier.
 * A milestone only one profile recorded is listed as not recorded for the other, never as
 * a difference.
 */
export function describeMilestoneTimings(
	comparison: ProfileComparison,
	sides?: ComparisonSideMilestones | null
): MilestoneTiming[] {
	const shared = comparison.milestones
		.filter((milestone) => !isCharge(milestone))
		.map((milestone) => {
			// Parchment reports the second profile's time minus the first profile's time.
			const delta = milestone.rightMilliseconds - milestone.leftMilliseconds;
			return {
				at: milestone.leftMilliseconds,
				timing: {
					name: milestone.name,
					label: milestoneLabel(milestone.name),
					leftTime: clock(milestone.leftMilliseconds),
					rightTime: clock(milestone.rightMilliseconds),
					difference:
						Math.abs(delta) < SAME_TIME_MILLISECONDS
							? 'Same time'
							: `${COMPARISON_SIDES.right} was ${formatDuration(delta)} ${delta < 0 ? 'earlier' : 'later'}`
				} satisfies MilestoneTiming
			};
		});
	const oneSided = sides ? oneSidedTimings(comparison, sides) : [];
	if (oneSided.length === 0) return shared.map((entry) => entry.timing);
	return [...shared, ...oneSided.map(({ at, ...timing }) => ({ at, timing }))]
		.sort((first, second) => first.at - second.at)
		.map((entry) => entry.timing);
}

/**
 * The milestone the two profiles reached furthest apart, as one line: "First crack: B was
 * 45 sec earlier". Null when no milestone both profiles recorded differs.
 */
export function largestMilestoneDifference(comparison: ProfileComparison): string | null {
	let largest: ProfileComparison['milestones'][number] | null = null;
	let largestDelta = 0;
	for (const milestone of comparison.milestones) {
		if (isCharge(milestone)) continue;
		const delta = milestone.rightMilliseconds - milestone.leftMilliseconds;
		if (Math.abs(delta) < SAME_TIME_MILLISECONDS || Math.abs(delta) <= Math.abs(largestDelta))
			continue;
		largest = milestone;
		largestDelta = delta;
	}
	if (!largest) return null;
	return `${milestoneLabel(largest.name)}: ${COMPARISON_SIDES.right} was ${formatDuration(largestDelta)} ${largestDelta < 0 ? 'earlier' : 'later'}`;
}

/**
 * The first thing to read about a comparison: the largest milestone difference, or that
 * there is none when every milestone both profiles recorded falls at the same time. Null
 * when they share no milestone after charge.
 */
export function milestoneHeadline(comparison: ProfileComparison): string | null {
	if (!comparison.milestones.some((milestone) => !isCharge(milestone))) return null;
	return largestMilestoneDifference(comparison) ?? 'All milestones: same time';
}
