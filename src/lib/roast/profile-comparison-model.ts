import type { components } from '@purveyors/sdk';
import type { ChartSeries, ProcessedChartData } from '$lib/components/roast/chart';

type SdkProfileComparison = components['schemas']['ProfileComparisonResponse']['data'];
type ProfileComparisonSeries =
	| SdkProfileComparison['series'][number]
	| (Omit<SdkProfileComparison['series'][number], 'kind'> & { kind: 'rate_of_rise' });

export type ProfileComparison = Omit<SdkProfileComparison, 'series'> & {
	series: ProfileComparisonSeries[];
};

const LEFT_COLORS = ['#b45309', '#0f766e', '#7c3aed', '#0891b2'];
const RIGHT_COLORS = ['#dc2626', '#2563eb', '#be185d', '#4f46e5'];

function domain(values: number[], fallback: [number, number]): [number, number] {
	if (values.length === 0) return fallback;
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (min === max) return [min - 1, max + 1];
	const padding = (max - min) * 0.08;
	return [Math.floor(min - padding), Math.ceil(max + padding)];
}

/** Adapt Parchment's measured comparison to the same chart renderer used by executed roasts. */
export function buildProfileComparisonChart(
	comparison: ProfileComparison,
	leftLabel: string,
	rightLabel: string
): ProcessedChartData {
	const series: ChartSeries[] = comparison.series.flatMap((entry, index) => {
		const axis: ChartSeries['axis'] =
			entry.kind === 'rate_of_rise'
				? 'ror'
				: entry.kind === 'auxiliary' && !/[cf]$/i.test(entry.unit)
					? 'control'
					: 'temperature';
		const shared = {
			kind: entry.kind,
			unit: entry.unit === comparison.targetUnit ? `°${entry.unit}` : entry.unit,
			axis,
			strokeWidth: entry.kind === 'bean_temperature' ? 3 : 2,
			curve: axis === 'control' ? ('linear' as const) : ('basis' as const)
		};
		return [
			{
				...shared,
				id: `left-${entry.id}`,
				label: `${leftLabel} · ${entry.name}`,
				color: LEFT_COLORS[index % LEFT_COLORS.length],
				points: entry.points.map((point) => ({
					timeMinutes: point.timeMilliseconds / 60_000,
					value: point.left
				}))
			},
			{
				...shared,
				id: `right-${entry.id}`,
				label: `${rightLabel} · ${entry.name}`,
				color: RIGHT_COLORS[index % RIGHT_COLORS.length],
				dashed: true,
				points: entry.points.map((point) => ({
					timeMinutes: point.timeMilliseconds / 60_000,
					value: point.right
				}))
			}
		] satisfies ChartSeries[];
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
		events: comparison.milestones.flatMap((milestone) => [
			{ timeMinutes: milestone.leftMilliseconds / 60_000, name: `${leftLabel}: ${milestone.name}` },
			{
				timeMinutes: milestone.rightMilliseconds / 60_000,
				name: `${rightLabel}: ${milestone.name}`
			}
		]),
		chargeTime: 0,
		temperatureUnit,
		xDomain: domain(times, [0, 12]),
		yTempDomain: domain(temperatures, comparison.targetUnit === 'C' ? [0, 260] : [100, 500]),
		yRorDomain: [0, comparison.targetUnit === 'C' ? 30 : 50]
	};
}
