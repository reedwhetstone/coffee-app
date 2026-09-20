import type { RoastChartData, RoastChartEvent, RoastChartSeries } from '@purveyors/sdk';
import type {
	ChartEvent,
	ChartPoint,
	ChartSeries,
	ControlSeries,
	ProcessedChartData
} from '$lib/components/roast/chart';
import type { RoastEventEntry } from './roast-types';

const SERIES_COLORS = [
	'#f59e0b',
	'#dc2626',
	'#2563eb',
	'#0f766e',
	'#7c3aed',
	'#b45309',
	'#0891b2',
	'#be185d'
];

const MILESTONE_NAMES = new Set([
	'charge',
	'start',
	'turning_point',
	'turning point',
	'dry_end',
	'dry end',
	'maillard',
	'fc_start',
	'first crack',
	'first crack start',
	'fc_end',
	'first crack end',
	'drop',
	'cool',
	'cool end',
	'end'
]);

export interface LoadedRoastChart {
	data: RoastChartData;
	chartData: ProcessedChartData;
}

export interface RoastChartAxisSettings {
	xRange: [number | null, number | null];
	yRange: [number | null, number | null];
	zRange: [number | null, number | null];
}

function normalizeTemperatureUnit(unit: string | null, fallback = '°F'): string {
	if (!unit) return fallback;
	const normalized = unit.trim().toLowerCase().replace('°', '');
	if (normalized === 'c' || normalized === 'celsius') return '°C';
	if (normalized === 'f' || normalized === 'fahrenheit') return '°F';
	return unit;
}

function isTemperatureUnit(unit: string | null): boolean {
	if (!unit) return false;
	const normalized = unit.trim().toLowerCase().replace('°', '');
	return ['c', 'f', 'celsius', 'fahrenheit'].includes(normalized);
}

function normalizeRateUnit(unit: string | null, temperatureUnit: string): string {
	if (!unit) return `${temperatureUnit}/min`;
	const normalized = unit.trim().toLowerCase().replace('°', '').replaceAll(' ', '');
	if (normalized === 'c/min' || normalized === 'celsius/min') return '°C/min';
	if (normalized === 'f/min' || normalized === 'fahrenheit/min') return '°F/min';
	return unit;
}

function isMilestone(event: RoastChartEvent): boolean {
	return (
		event.category.toLowerCase() === 'milestone' || MILESTONE_NAMES.has(event.name.toLowerCase())
	);
}

function isControlEvent(event: RoastChartEvent): boolean {
	const category = event.category.toLowerCase();
	return category === 'control' || category === 'machine';
}

function parseControlValue(event: RoastChartEvent): number | null {
	if (!isControlEvent(event) || event.value === null) return null;
	const value = Number.parseFloat(String(event.value));
	return Number.isFinite(value) ? value : null;
}

function resolveChargeTime(data: RoastChartData): number {
	if (data.metadata.charge_time_ms !== null) return data.metadata.charge_time_ms;
	const charge = data.events.find((event) =>
		['charge', 'start'].includes(event.name.toLowerCase())
	);
	if (charge) return charge.time_milliseconds;
	const pointTimes = data.series.flatMap((series) =>
		series.points.map((point) => point.time_milliseconds)
	);
	return pointTimes.length > 0 ? Math.min(...pointTimes) : 0;
}

function displayName(series: RoastChartSeries): string {
	if (series.kind === 'bean_temperature') return 'Bean Temp (BT)';
	if (series.kind === 'environmental_temperature') return 'Env Temp (ET)';
	if (series.kind === 'ambient_temperature') return 'Ambient Temp';
	if (series.kind === 'rate_of_rise') return 'BT RoR';
	return series.name;
}

function primaryTemperatureUnit(data: RoastChartData): string {
	const primaryTemperature =
		data.series.find(
			(series) => series.kind === 'bean_temperature' && isTemperatureUnit(series.unit)
		) ??
		data.series.find(
			(series) =>
				['environmental_temperature', 'ambient_temperature'].includes(series.kind) &&
				isTemperatureUnit(series.unit)
		);
	return normalizeTemperatureUnit(
		data.metadata.temperature_unit || primaryTemperature?.unit || null
	);
}

function seriesColor(series: RoastChartSeries, index: number): string {
	if (series.kind === 'bean_temperature') return '#f59e0b';
	if (series.kind === 'environmental_temperature') return '#dc2626';
	if (series.kind === 'ambient_temperature') return '#0f766e';
	if (series.kind === 'rate_of_rise') return '#2563eb';
	return SERIES_COLORS[(index + 4) % SERIES_COLORS.length];
}

function mapCanonicalSeries(
	series: RoastChartSeries,
	chargeTime: number,
	index: number,
	temperatureUnit: string
): ChartSeries {
	const axis =
		series.kind === 'rate_of_rise'
			? 'ror'
			: series.kind !== 'auxiliary' || isTemperatureUnit(series.unit)
				? 'temperature'
				: 'control';
	const unit =
		series.kind === 'rate_of_rise'
			? normalizeRateUnit(series.unit, temperatureUnit)
			: axis === 'temperature'
				? normalizeTemperatureUnit(series.unit, temperatureUnit)
				: series.unit;

	return {
		id: series.id,
		label: displayName(series),
		kind: series.kind,
		unit,
		axis,
		color: seriesColor(series, index),
		strokeWidth: series.kind === 'bean_temperature' ? 3 : 2,
		dashed: series.kind === 'bean_temperature',
		curve: axis === 'control' ? 'linear' : 'basis',
		points: series.points.map((point) => ({
			timeMinutes: (point.time_milliseconds - chargeTime) / 60_000,
			value: point.value_numeric
		}))
	};
}

function controlSeriesFromEvents(
	events: RoastChartEvent[],
	chargeTime: number,
	startTime: number,
	endTime: number,
	colorOffset: number
): ChartSeries[] {
	const grouped = new Map<string, Array<{ time: number; value: number }>>();
	for (const event of events) {
		const value = parseControlValue(event);
		if (value === null) continue;
		const values = grouped.get(event.name) ?? [];
		values.push({ time: event.time_milliseconds, value });
		grouped.set(event.name, values);
	}

	return Array.from(grouped.entries()).map(([name, values], index) => {
		const sorted = values.sort((left, right) => left.time - right.time);
		const points = [
			{ time: startTime, value: sorted[0].value },
			...sorted,
			{ time: endTime, value: sorted[sorted.length - 1].value }
		].map(({ time, value }) => ({ timeMinutes: (time - chargeTime) / 60_000, value }));
		return {
			id: `control-${name}`,
			label: name.replace(/_setting/g, '').replace(/_/g, ' '),
			kind: 'control',
			unit: null,
			axis: 'control',
			color: SERIES_COLORS[(colorOffset + index) % SERIES_COLORS.length],
			strokeWidth: 2,
			curve: 'stepAfter',
			points
		};
	});
}

function valueDomain(values: number[], fallback: [number, number]): [number, number] {
	if (values.length === 0) return fallback;
	const minimum = Math.min(...values);
	const maximum = Math.max(...values);
	if (minimum === maximum) return [minimum - 1, maximum + 1];
	const padding = (maximum - minimum) * 0.08;
	return [Math.floor(minimum - padding), Math.ceil(maximum + padding)];
}

/** Build the one saved-roast chart model used by the roast page and GenUI. */
export function buildRoastChartModel(
	data: RoastChartData,
	settings: RoastChartAxisSettings | null = null
): ProcessedChartData {
	const chargeTime = resolveChargeTime(data);
	const temperatureUnit = primaryTemperatureUnit(data);
	const canonicalSeries = data.series.map((series, index) =>
		mapCanonicalSeries(series, chargeTime, index, temperatureUnit)
	);
	const seriesTimes = data.series.flatMap((series) =>
		series.points.map((point) => point.time_milliseconds)
	);
	const controlEventTimes = data.events.flatMap((event) =>
		parseControlValue(event) === null ? [] : [event.time_milliseconds]
	);
	const allTimes = [...seriesTimes, ...controlEventTimes];
	const startTime = Math.min(data.metadata.time_min_ms ?? Infinity, ...allTimes, chargeTime);
	const endTime = Math.max(data.metadata.time_max_ms ?? -Infinity, ...allTimes, chargeTime);
	const controls = controlSeriesFromEvents(
		data.events,
		chargeTime,
		startTime,
		endTime,
		canonicalSeries.length
	);
	const series = [...canonicalSeries, ...controls];
	const primary = (kind: ChartSeries['kind']): ChartPoint[] =>
		series.find((entry) => entry.kind === kind)?.points ?? [];
	const controlSeries: ControlSeries[] = series
		.filter((entry) => entry.axis === 'control')
		.map((entry) => ({
			name: entry.label,
			color: entry.color,
			strokeWidth: entry.strokeWidth,
			points: entry.points
		}));
	const chartEvents: ChartEvent[] = data.events.filter(isMilestone).map((event) => ({
		timeMinutes: (event.time_milliseconds - chargeTime) / 60_000,
		name: event.name
	}));
	const timeValues = series.flatMap((entry) => entry.points.map((point) => point.timeMinutes));
	const temperatureValues = series
		.filter((entry) => entry.axis === 'temperature')
		.flatMap((entry) => entry.points.map((point) => point.value));
	const rorValues = series
		.filter((entry) => entry.axis === 'ror')
		.flatMap((entry) => entry.points.map((point) => point.value));

	const xDomain =
		settings && settings.xRange[0] !== null && settings.xRange[1] !== null
			? ([settings.xRange[0], settings.xRange[1]] as [number, number])
			: valueDomain(timeValues, [-2, 12]);
	const yTempDomain =
		settings && settings.yRange[0] !== null && settings.yRange[1] !== null
			? ([settings.yRange[0], settings.yRange[1]] as [number, number])
			: valueDomain(temperatureValues, temperatureUnit === '°C' ? [0, 260] : [100, 500]);
	const yRorDomain =
		settings && settings.zRange[0] !== null && settings.zRange[1] !== null
			? ([settings.zRange[0], settings.zRange[1]] as [number, number])
			: valueDomain(rorValues, [0, temperatureUnit === '°C' ? 30 : 50]);

	return {
		temperaturePoints: primary('bean_temperature'),
		envTempPoints: primary('environmental_temperature'),
		rorPoints: primary('rate_of_rise'),
		controlSeries,
		series,
		events: chartEvents,
		chargeTime,
		temperatureUnit,
		xDomain,
		yTempDomain,
		yRorDomain
	};
}

export async function fetchRoastChartModel(
	roastId: number,
	fetchFn: typeof fetch = fetch,
	settings: RoastChartAxisSettings | null = null
): Promise<LoadedRoastChart | null> {
	const response = await fetchFn(`/api/roast-chart-data?roastId=${roastId}`);
	if (!response.ok) return null;
	const data = (await response.json()) as RoastChartData;
	if (data.series.length === 0 && data.events.length === 0) return null;
	return { data, chartData: buildRoastChartModel(data, settings) };
}

export function chartEventsToRoastEntries(
	events: RoastChartEvent[],
	roastId: number
): RoastEventEntry[] {
	return events.map((event) => ({
		roast_id: roastId,
		time_seconds: event.time_milliseconds / 1_000,
		event_type: isMilestone(event) ? 10 : 1,
		event_value: event.value,
		event_string: event.name,
		category:
			event.category === 'control' || event.category === 'machine'
				? event.category
				: isMilestone(event)
					? 'milestone'
					: 'control',
		subcategory: event.subcategory,
		user_generated: false,
		automatic: true
	}));
}
