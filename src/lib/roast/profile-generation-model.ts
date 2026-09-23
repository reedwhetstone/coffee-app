import type { components } from '@purveyors/sdk';
import type { ChartSeries, ProcessedChartData } from '$lib/components/roast/chart';

type ReferenceChart = components['schemas']['ReferenceProfileChart'];

function domain(values: number[], fallback: [number, number]): [number, number] {
	if (!values.length) return fallback;
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (min === max) return [min - 1, max + 1];
	const padding = (max - min) * 0.08;
	return [Math.floor(min - padding), Math.ceil(max + padding)];
}

/** Preview the proposed curve beside its immutable parent. Event markers remain unchanged. */
export function buildProfileGenerationChart(
	parent: ReferenceChart,
	preview: ReferenceChart
): ProcessedChartData {
	const colors = ['#b45309', '#0f766e', '#7c3aed', '#0891b2'];
	const makeSeries = (chart: ReferenceChart, proposed: boolean): ChartSeries[] =>
		chart.series.map((entry, index) => ({
			id: `${proposed ? 'proposed' : 'parent'}-${entry.id}`,
			label: `${proposed ? 'Proposed' : 'Parent'} · ${entry.name}`,
			kind: entry.kind,
			unit: entry.unit,
			axis:
				entry.kind === 'auxiliary' && entry.unit !== chart.temperatureUnit
					? 'control'
					: 'temperature',
			strokeWidth: proposed && entry.kind === 'bean_temperature' ? 3 : 2,
			curve: 'linear',
			color: colors[index % colors.length],
			dashed: !proposed,
			points: entry.points.map((point) => ({
				timeMinutes: point.timeMilliseconds / 60_000,
				value: point.value
			}))
		}));
	const series = [...makeSeries(parent, false), ...makeSeries(preview, true)];
	const times = series.flatMap((entry) => entry.points.map((point) => point.timeMinutes));
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
		events: preview.events.map((event) => ({
			timeMinutes: event.timeMilliseconds / 60_000,
			name: event.name
		})),
		chargeTime:
			preview.chargeTimeMilliseconds === null ? 0 : preview.chargeTimeMilliseconds / 60_000,
		temperatureUnit,
		xDomain: domain(times, [0, 12]),
		yTempDomain: domain(temperatures, preview.temperatureUnit === 'C' ? [0, 260] : [100, 500]),
		yRorDomain: [0, preview.temperatureUnit === 'C' ? 30 : 50]
	};
}
