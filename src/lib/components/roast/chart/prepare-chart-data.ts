import type { ProcessedChartData, ChartPoint, ControlSeries, ChartEvent } from './chart-types';

/** Colors for Artisan import event value series */
const EVENT_COLORS = [
	'#b45309', // Brown for heat-related events
	'#3730a3', // Blue for air/fan-related events
	'#059669', // Green for other control events
	'#7c2d12', // Dark red for burner events
	'#6d28d9', // Purple for additional events
	'#ea580c', // Orange for temperature control
	'#0891b2' // Teal for miscellaneous
];

interface EventValuePoint {
	time_seconds: number;
	value: number;
}

interface EventValueSeries {
	event_string: string;
	category: string;
	values: EventValuePoint[];
	value_range: {
		min: number;
		max: number;
		detected_scale: string;
	};
}

interface RoastPoint {
	time: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	heat: number;
	fan: number;
	data_source?: string;
}

interface RoastEventEntry {
	time_seconds: number;
	event_type: number;
	event_value: string | null;
	event_string: string;
	category?: string;
}

interface ChartSettings {
	xRange: [number | null, number | null];
	yRange: [number | null, number | null];
	zRange: [number | null, number | null];
}

interface RoastEvent {
	time: number;
	name: string;
}

/**
 * Moving average smoothing for temperature data
 */
function smoothData(
	data: { time: number; temp: number }[],
	windowSize: number
): { time: number; temp: number }[] {
	if (data.length === 0) return [];
	const smoothed: { time: number; temp: number }[] = [];
	for (let i = 0; i < data.length; i++) {
		const start = Math.max(0, i - Math.floor(windowSize / 2));
		const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
		let sum = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			sum += data[j].temp;
			count++;
		}
		smoothed.push({ time: data[i].time, temp: sum / count });
	}
	return smoothed;
}

/**
 * Extract milestone names from event entries
 */
function extractMilestoneNames(events: RoastEventEntry[]): {
	charge: number | null;
	drop: number | null;
	end: number | null;
} {
	let charge: number | null = null;
	let drop: number | null = null;
	let end: number | null = null;
	for (const e of events) {
		const name = (e.event_string || '').toLowerCase();
		const timeMs = e.time_seconds * 1000;
		if (name.includes('charge') || name === 'start') charge = timeMs;
		if (name.includes('drop')) drop = timeMs;
		if (name.includes('cool end') || name === 'end') end = timeMs;
	}
	return { charge, drop, end };
}

/**
 * Compute charge time from roast data/events
 */
function computeChargeTime(
	data: RoastPoint[],
	events: RoastEventEntry[],
	roastEvents: RoastEvent[]
): number {
	// Try event entries first
	if (events.length > 0) {
		const ms = extractMilestoneNames(events);
		if (ms.charge !== null) return ms.charge;
	}
	// Try roast events
	for (const e of roastEvents) {
		if (e.name.toLowerCase().includes('charge') || e.name.toLowerCase() === 'start') {
			return e.time;
		}
	}
	// Fallback: first data point
	return data.length > 0 ? data[0].time : 0;
}

/**
 * Calculate BT Rate of Rise with smoothing
 */
function calculateRoR(
	data: RoastPoint[],
	chargeTime: number,
	dropTime: number | null
): ChartPoint[] {
	if (data.length < 2) return [];

	const validTempData = data
		.filter((p) => p.bean_temp !== null && p.bean_temp !== undefined && p.bean_temp > 0)
		.map((p) => ({ time: p.time, temp: p.bean_temp! }));

	if (validTempData.length < 15) return [];

	const smoothedTemp = smoothData(validTempData, 15);
	const rawRor: { time: number; temp: number }[] = [];

	for (let i = 1; i < smoothedTemp.length; i++) {
		const cur = smoothedTemp[i];
		const prev = smoothedTemp[i - 1];
		const timeDiffMin = ((cur.time || 0) - (prev.time || 0)) / (1000 * 60);
		const tempDiff = cur.temp - prev.temp;

		if (timeDiffMin > 0) {
			const ror = tempDiff / timeDiffMin;
			let include = true;
			if (chargeTime && dropTime) {
				include = cur.time >= chargeTime && cur.time <= dropTime;
			} else if (chargeTime) {
				include = cur.time >= chargeTime;
			}
			if (include && Math.abs(ror) <= 50 && ror > 0) {
				rawRor.push({ time: cur.time, temp: ror });
			}
		}
	}

	if (rawRor.length === 0) return [];

	return smoothData(rawRor, 10).map((p) => ({
		timeMinutes: (p.time - chargeTime) / (1000 * 60),
		value: p.temp
	}));
}

/**
 * Build control series from either savedEventValueSeries (Artisan) or processedData (live)
 */
function buildControlSeries(
	data: RoastPoint[],
	savedEventValueSeries: EventValueSeries[],
	chargeTime: number,
	_chartSettings: ChartSettings | null,
	events: RoastEventEntry[]
): ControlSeries[] {
	if (savedEventValueSeries.length > 0) {
		return buildSavedEventControlSeries(
			savedEventValueSeries,
			chargeTime,
			data,
			_chartSettings,
			events
		);
	}
	return buildLiveControlSeries(data, chargeTime);
}

function buildSavedEventControlSeries(
	series: EventValueSeries[],
	chargeTime: number,
	data: RoastPoint[],
	chartSettings: ChartSettings | null,
	events: RoastEventEntry[]
): ControlSeries[] {
	const result: ControlSeries[] = [];
	const ms = extractMilestoneNames(events);

	series.forEach((s, idx) => {
		if (s.values.length === 0) return;
		const color = EVENT_COLORS[idx % EVENT_COLORS.length];
		const sorted = [...s.values].sort((a, b) => a.time_seconds - b.time_seconds);

		// Determine chart bounds
		const chartStart =
			data.length > 0 ? Math.min(...data.map((d) => d.time)) : sorted[0].time_seconds * 1000;

		let chartEnd: number;
		if (chartSettings?.xRange && chartSettings.xRange[1] !== null) {
			chartEnd = chargeTime + chartSettings.xRange[1] * 60 * 1000;
		} else if (ms.end) {
			chartEnd = ms.end + 60 * 1000;
		} else if (ms.drop) {
			chartEnd = ms.drop + 2 * 60 * 1000;
		} else if (data.length > 0) {
			chartEnd = Math.max(...data.map((d) => d.time)) + 60 * 1000;
		} else {
			chartEnd = sorted[sorted.length - 1].time_seconds * 1000 + 60 * 1000;
		}

		const points: ChartPoint[] = [];
		// Anchor at chart start
		points.push({
			timeMinutes: (chartStart - chargeTime) / (1000 * 60),
			value: sorted[0].value
		});
		for (const v of sorted) {
			points.push({
				timeMinutes: (v.time_seconds * 1000 - chargeTime) / (1000 * 60),
				value: v.value
			});
		}
		// Extend to chart end
		points.push({
			timeMinutes: (chartEnd - chargeTime) / (1000 * 60),
			value: sorted[sorted.length - 1].value
		});

		result.push({
			name: s.event_string,
			color,
			strokeWidth: 2,
			points
		});
	});

	return result;
}

function buildLiveControlSeries(data: RoastPoint[], chargeTime: number): ControlSeries[] {
	const series: ControlSeries[] = [];

	const fanData = data
		.filter((d) => d.fan != null)
		.map((d) => ({
			timeMinutes: (d.time - chargeTime) / (1000 * 60),
			value: d.fan
		}));

	if (fanData.length > 0 && fanData.some((d) => d.value > 0)) {
		series.push({
			name: 'fan_setting',
			color: '#3730a3',
			strokeWidth: 2,
			points: fanData
		});
	}

	const heatData = data
		.filter((d) => d.heat != null)
		.map((d) => ({
			timeMinutes: (d.time - chargeTime) / (1000 * 60),
			value: d.heat
		}));

	if (heatData.length > 0 && heatData.some((d) => d.value > 0)) {
		series.push({
			name: 'heat_setting',
			color: '#b45309',
			strokeWidth: 2,
			points: heatData
		});
	}

	return series;
}

/**
 * Main function: prepare all chart data from raw roast data
 */
export function prepareChartData(params: {
	roastData: RoastPoint[];
	events: RoastEventEntry[];
	roastEvents: RoastEvent[];
	savedEventValueSeries: EventValueSeries[];
	chartSettings: ChartSettings | null;
	isDuringRoasting: boolean;
}): ProcessedChartData {
	const { roastData, events, roastEvents, savedEventValueSeries, chartSettings, isDuringRoasting } =
		params;

	const chargeTime = computeChargeTime(roastData, events, roastEvents);
	const ms = extractMilestoneNames(events);

	// Process and sort data
	let lastHeat = 0;
	let lastFan = 0;
	const sortedData = [...roastData].sort((a, b) => a.time - b.time);
	const processed = sortedData.map((p) => {
		if (p.heat != null) lastHeat = p.heat;
		if (p.fan != null) lastFan = p.fan;
		return { ...p, heat: p.heat ?? lastHeat, fan: p.fan ?? lastFan };
	});

	// BT points
	const temperaturePoints: ChartPoint[] = processed
		.filter((d) => d.bean_temp !== null && d.bean_temp !== undefined && d.bean_temp > 0)
		.map((d) => ({
			timeMinutes: (d.time - chargeTime) / (1000 * 60),
			value: d.bean_temp!
		}));

	// ET points
	const envTempPoints: ChartPoint[] = processed
		.filter(
			(d) =>
				d.environmental_temp !== null &&
				d.environmental_temp !== undefined &&
				d.environmental_temp > 0
		)
		.map((d) => ({
			timeMinutes: (d.time - chargeTime) / (1000 * 60),
			value: d.environmental_temp!
		}));

	// RoR
	const rorPoints = calculateRoR(processed, chargeTime, ms.drop);

	// Control series
	const controlSeries = buildControlSeries(
		processed,
		savedEventValueSeries,
		chargeTime,
		chartSettings,
		events
	);

	// Events (milestone markers)
	const chartEvents: ChartEvent[] = [];
	if (isDuringRoasting) {
		for (const e of roastEvents) {
			chartEvents.push({
				timeMinutes: (e.time - chargeTime) / (1000 * 60),
				name: e.name
			});
		}
	} else {
		for (const e of events) {
			if (e.category === 'milestone' || e.event_type === 10) {
				chartEvents.push({
					timeMinutes: (e.time_seconds * 1000 - chargeTime) / (1000 * 60),
					name: e.event_string
				});
			}
		}
	}

	// Compute domains
	const hasSavedX =
		chartSettings?.xRange && chartSettings.xRange[0] !== null && chartSettings.xRange[1] !== null;
	const hasSavedY =
		chartSettings?.yRange && chartSettings.yRange[0] !== null && chartSettings.yRange[1] !== null;
	const hasSavedZ =
		chartSettings?.zRange && chartSettings.zRange[0] !== null && chartSettings.zRange[1] !== null;

	let xDomain: [number, number];
	if (hasSavedX) {
		xDomain = [chartSettings!.xRange[0]!, chartSettings!.xRange[1]!];
	} else if (temperaturePoints.length > 0) {
		const minT = Math.min(...temperaturePoints.map((d) => d.timeMinutes));
		const maxT = Math.max(...temperaturePoints.map((d) => d.timeMinutes));
		xDomain = [Math.min(minT, -2), Math.max(maxT, 12)];
	} else {
		xDomain = [-2, 12];
	}

	const yTempDomain: [number, number] = hasSavedY
		? [chartSettings!.yRange[0]!, chartSettings!.yRange[1]!]
		: [100, 500];

	const yRorDomain: [number, number] = hasSavedZ
		? [chartSettings!.zRange[0]!, chartSettings!.zRange[1]!]
		: [0, 50];

	return {
		temperaturePoints,
		envTempPoints,
		rorPoints,
		controlSeries,
		events: chartEvents,
		chargeTime,
		xDomain,
		yTempDomain,
		yRorDomain
	};
}
