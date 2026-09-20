/**
 * Data fetching, transformation, and conversion for roast data.
 *
 * Handles the bridge between API responses and chart-ready data structures.
 * No Svelte dependencies; pure data transformation.
 */

import type {
	RoastPoint,
	RoastEvent,
	RoastEventEntry,
	TemperatureEntry,
	EventValueSeries
} from './roast-types';
import { secondsToMs, formatDisplayName, mapControlName } from './roast-math';

// ─── Data Conversion ─────────────────────────────────────────────────────────

/**
 * Convert normalized temperature + event entries to chart-ready format.
 *
 * Temperature entries become RoastPoints with control values carried forward.
 * Milestone events become RoastEvents for chart markers.
 */
export function convertToChartData(
	temperatures: TemperatureEntry[],
	events: RoastEventEntry[]
): { roastData: RoastPoint[]; roastEvents: RoastEvent[] } {
	// Sort control events by time for carry-forward logic
	const fanEvents = events
		.filter((e) => e.event_string === 'fan_setting')
		.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));
	const heatEvents = events
		.filter((e) => e.event_string === 'heat_setting')
		.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));

	// Convert temperature entries to chart data with control values carried forward
	const roastData: RoastPoint[] = temperatures.map((temp) => {
		const tempTimeSeconds = parseFloat(String(temp.time_seconds));

		// Find most recent control events at or before this time
		const fanEvent = fanEvents
			.filter((e) => parseFloat(String(e.time_seconds)) <= tempTimeSeconds)
			.pop();
		const heatEvent = heatEvents
			.filter((e) => parseFloat(String(e.time_seconds)) <= tempTimeSeconds)
			.pop();

		// Find milestone events at this time (within 1 second tolerance)
		const milestoneEvents = events.filter(
			(e) =>
				e.category === 'milestone' &&
				Math.abs(parseFloat(String(e.time_seconds)) - tempTimeSeconds) < 1
		);

		return {
			time: secondsToMs(tempTimeSeconds),
			heat: heatEvent ? parseInt(heatEvent.event_value || '0') : 0,
			fan: fanEvent ? parseInt(fanEvent.event_value || '0') : 0,
			bean_temp: temp.bean_temp,
			environmental_temp: temp.environmental_temp,
			ambient_temp: temp.ambient_temp,
			ror_bean_temp: temp.ror_bean_temp,
			data_source: temp.data_source,
			charge: milestoneEvents.some((e) => e.event_string === 'charge'),
			start: milestoneEvents.some((e) => e.event_string === 'start'),
			maillard: milestoneEvents.some(
				(e) => e.event_string === 'dry_end' || e.event_string === 'maillard'
			),
			fc_start: milestoneEvents.some((e) => e.event_string === 'fc_start'),
			drop: milestoneEvents.some((e) => e.event_string === 'drop'),
			end: milestoneEvents.some((e) => e.event_string === 'cool' || e.event_string === 'end')
		};
	});

	// Convert milestone events to chart display format
	const roastEvents: RoastEvent[] = events
		.filter((e) => e.category === 'milestone')
		.map((event) => ({
			time: secondsToMs(event.time_seconds),
			name: formatDisplayName(event.event_string)
		}));

	return { roastData, roastEvents };
}

// ─── Event Value Series ──────────────────────────────────────────────────────

/**
 * Build event value series from control events for chart rendering.
 * Groups events by type (fan_setting, heat_setting, etc.) and tracks min/max.
 */
export function buildEventValueSeries(events: RoastEventEntry[]): EventValueSeries[] {
	const seriesMap = new Map<string, EventValueSeries>();

	for (const event of events) {
		if (event.category !== 'control' || !event.event_value) continue;

		const value = parseFloat(event.event_value);
		if (isNaN(value)) continue;

		const key = event.event_string;
		const displayName = mapControlName(key);

		if (!seriesMap.has(key)) {
			seriesMap.set(key, {
				event_string: key,
				display_name: formatDisplayName(displayName),
				values: [],
				min_value: value,
				max_value: value
			});
		}

		const series = seriesMap.get(key)!;
		series.values.push({
			time_seconds: event.time_seconds,
			value
		});
		series.min_value = Math.min(series.min_value, value);
		series.max_value = Math.max(series.max_value, value);
	}

	return Array.from(seriesMap.values());
}

// ─── Roast Event Creation ────────────────────────────────────────────────────

/**
 * Create milestone and control events for a roast milestone log.
 * Returns both the milestone event and the accompanying control state snapshot.
 */
export function createMilestoneEvents(
	eventName: string,
	roastId: number,
	currentTimeMs: number,
	fanValue: number,
	heatValue: number
): { milestoneEvent: RoastEventEntry; controlEvents: RoastEventEntry[] } {
	const timeSeconds = currentTimeMs / 1000;
	const normalizedName = eventName.toLowerCase().replace(/\s+/g, '_');

	const milestoneEvent: RoastEventEntry = {
		roast_id: roastId,
		time_seconds: timeSeconds,
		event_type: 10,
		event_value: null,
		event_string: normalizedName,
		category: 'milestone',
		subcategory: 'roast_phase',
		user_generated: true,
		automatic: false
	};

	const controlEvents: RoastEventEntry[] = [
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: fanValue.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		},
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: normalizedName === 'drop' ? '0' : heatValue.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		}
	];

	return { milestoneEvent, controlEvents };
}

// ─── Chart Settings ──────────────────────────────────────────────────────────

/** Chart axis settings in the range-tuple format used by prepare-chart-data */
export interface ChartAxisSettings {
	xRange: [number | null, number | null];
	yRange: [number | null, number | null];
	zRange: [number | null, number | null];
}

/**
 * Fetch chart axis settings for a roast from the roast_profiles table.
 * Normalizes xRange from seconds to minutes if needed.
 */
export async function fetchChartSettings(
	roastId: number,
	fetchFn: typeof fetch = fetch
): Promise<ChartAxisSettings | null> {
	try {
		const response = await fetchFn(`/api/roast-chart-settings?roastId=${roastId}`);
		if (!response.ok) return null;

		const result = await response.json();
		const settings = result.settings;
		if (!settings) return null;

		// Normalize xRange to minutes if values appear to be in seconds
		let xMin = settings.xRange[0];
		let xMax = settings.xRange[1];
		const looksLikeSeconds =
			xMin !== null &&
			xMax !== null &&
			typeof xMin === 'number' &&
			typeof xMax === 'number' &&
			(xMin > 60 || xMax > 60);

		if (looksLikeSeconds) {
			xMin = xMin !== null ? xMin / 60 : xMin;
			xMax = xMax !== null ? xMax / 60 : xMax;
		}

		return {
			xRange: [xMin, xMax],
			yRange: [settings.yRange[0], settings.yRange[1]],
			zRange: [settings.zRange[0], settings.zRange[1]]
		};
	} catch (error) {
		console.error('Error loading chart settings:', error);
		return null;
	}
}

// ─── Control Event Creation ──────────────────────────────────────────────────

/**
 * Create control event entries for a fan/heat settings change snapshot.
 * Used when fan or heat values change during live roasting.
 */
export function createControlEvents(
	roastId: number,
	currentTimeMs: number,
	fanValue: number,
	heatValue: number
): RoastEventEntry[] {
	const timeSeconds = currentTimeMs / 1000;
	return [
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: fanValue.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		},
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: heatValue.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		}
	];
}
