import type { components } from '@purveyors/sdk';
import type { ChartSeries, ProcessedChartData } from '$lib/components/roast/chart';
import {
	isAbsentReading,
	isMissingReading,
	realReadings
} from '$lib/components/roast/chart/chart-utils';

type ReferenceChart = components['schemas']['ReferenceProfileChart'];

function domain(values: number[], fallback: [number, number]): [number, number] {
	if (!values.length) return fallback;
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (min === max) return [min - 1, max + 1];
	const padding = (max - min) * 0.08;
	return [Math.floor(min - padding), Math.ceil(max + padding)];
}

/** Offset between Parchment's logger timestamps and the charge-aligned chart axis. */
export function chargeOffsetMilliseconds(chart: ReferenceChart): number {
	return chart.chargeTimeMilliseconds ?? 0;
}

/** One saved reference's curve on its own, each line named for what it measures. */
export function buildReferenceCurveChart(chart: ReferenceChart): ProcessedChartData {
	const data = buildProfileGenerationChart(null, chart);
	return {
		...data,
		series: data.series?.map((entry) => ({ ...entry, label: entry.label.replace(/^Plan · /, '') }))
	};
}

/**
 * Draw a plan over the curve it started from, both timed from charge. A saved plan whose
 * starting curve is no longer on record is drawn alone. Milestones render as markers;
 * control events remain unchanged but unmarked.
 */
export function buildProfileGenerationChart(
	parent: ReferenceChart | null,
	preview: ReferenceChart
): ProcessedChartData {
	const colors = ['#b45309', '#0f766e', '#7c3aed', '#0891b2'];
	const makeSeries = (chart: ReferenceChart, proposed: boolean): ChartSeries[] =>
		chart.series
			.map((entry, index): ChartSeries => {
				const axis =
					entry.kind === 'auxiliary' && entry.unit !== chart.temperatureUnit
						? 'control'
						: 'temperature';
				return {
					id: `${proposed ? 'proposed' : 'parent'}-${entry.id}`,
					label: `${proposed ? 'Plan' : 'Started from'} · ${entry.name}`,
					kind: entry.kind,
					unit: entry.unit,
					axis,
					strokeWidth: proposed && entry.kind === 'bean_temperature' ? 3 : 2,
					curve: 'linear',
					color: colors[index % colors.length],
					dashed: !proposed,
					// Saved references can still carry Artisan's -1 "no reading" marker.
					points: realReadings(
						entry.points.map((point) => ({
							timeMinutes: (point.timeMilliseconds - chargeOffsetMilliseconds(chart)) / 60_000,
							value: point.value
						})),
						axis === 'temperature' ? isMissingReading : isAbsentReading
					)
				};
			})
			// A channel with no real readings, such as a probe that was never connected, is left out.
			.filter((entry) => entry.points.length > 0);
	const charts = parent ? [parent, preview] : [preview];
	const series = [...(parent ? makeSeries(parent, false) : []), ...makeSeries(preview, true)];
	// The time axis covers every sample, with or without a reading.
	const times = charts.flatMap((chart) =>
		chart.series.flatMap((entry) =>
			entry.points.map(
				(point) => (point.timeMilliseconds - chargeOffsetMilliseconds(chart)) / 60_000
			)
		)
	);
	const temperatures = series
		.filter((entry) => entry.axis === 'temperature')
		.flatMap((entry) => entry.points.map((point) => point.value));
	const temperatureUnit = `°${preview.temperatureUnit}`;
	return {
		temperaturePoints:
			series.find((entry) => entry.id.startsWith('proposed-') && entry.kind === 'bean_temperature')
				?.points ?? [],
		envTempPoints:
			series.find(
				(entry) => entry.id.startsWith('proposed-') && entry.kind === 'environmental_temperature'
			)?.points ?? [],
		rorPoints: [],
		controlSeries: [],
		series,
		events: preview.events
			.filter((event) => event.category === 'milestone')
			.map((event) => ({
				timeMinutes: (event.timeMilliseconds - chargeOffsetMilliseconds(preview)) / 60_000,
				name: event.name
			})),
		chargeTime: chargeOffsetMilliseconds(preview),
		temperatureUnit,
		xDomain: domain(times, [0, 12]),
		yTempDomain: domain(temperatures, preview.temperatureUnit === 'C' ? [0, 260] : [100, 500]),
		yRorDomain: [0, preview.temperatureUnit === 'C' ? 30 : 50]
	};
}
