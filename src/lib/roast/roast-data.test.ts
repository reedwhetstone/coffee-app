import { describe, it, expect, vi } from 'vitest';
import {
	convertToChartData,
	buildEventValueSeries,
	createMilestoneEvents,
	processRawChartData,
	fetchChartSettings,
	createControlEvents,
	loadAndProcessRoastData,
	fetchRoastChartData
} from './roast-data';
import type { TemperatureEntry, RoastEventEntry } from './roast-types';
import type { RawChartDataRow } from './roast-data';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true): typeof fetch {
	return vi.fn().mockResolvedValue({
		ok,
		status: ok ? 200 : 500,
		json: () => Promise.resolve(data)
	}) as unknown as typeof fetch;
}

function makeTempRow(timeMs: number, field: string, value: number | null): RawChartDataRow {
	return {
		time_milliseconds: timeMs,
		data_type: 'temperature',
		field_name: field,
		value_numeric: value
	};
}

function makeMilestoneRow(timeMs: number, eventString: string): RawChartDataRow {
	return {
		time_milliseconds: timeMs,
		data_type: 'milestone',
		field_name: eventString,
		value_numeric: null,
		event_string: eventString,
		subcategory: 'roast_phase'
	};
}

function makeControlRow(timeMs: number, eventString: string, value: number): RawChartDataRow {
	return {
		time_milliseconds: timeMs,
		data_type: 'control',
		field_name: eventString,
		value_numeric: value,
		event_string: eventString,
		subcategory: 'machine_setting'
	};
}

/** Build a realistic raw dataset for a 10-minute roast */
function buildRealisticRoastData(): RawChartDataRow[] {
	const rows: RawChartDataRow[] = [];

	// Temperature readings every 2 seconds for 10 minutes
	for (let sec = 0; sec <= 600; sec += 2) {
		const ms = sec * 1000;
		// Simulate bean temp curve: starts at 200, rises to ~400
		const beanTemp = 200 + (sec / 600) * 200;
		rows.push(makeTempRow(ms, 'bean_temp', Math.round(beanTemp * 10) / 10));
		rows.push(makeTempRow(ms, 'environmental_temp', 350 + (sec / 600) * 50));
	}

	// Milestones
	rows.push(makeMilestoneRow(0, 'charge'));
	rows.push(makeMilestoneRow(180000, 'dry_end')); // 3 min
	rows.push(makeMilestoneRow(360000, 'fc_start')); // 6 min
	rows.push(makeMilestoneRow(540000, 'drop')); // 9 min

	// Control events
	rows.push(makeControlRow(0, 'fan_setting', 5));
	rows.push(makeControlRow(0, 'heat_setting', 8));
	rows.push(makeControlRow(120000, 'fan_setting', 7)); // 2 min
	rows.push(makeControlRow(300000, 'heat_setting', 6)); // 5 min
	rows.push(makeControlRow(540000, 'heat_setting', 0)); // drop

	return rows;
}

// ─── convertToChartData ──────────────────────────────────────────────────────

describe('convertToChartData', () => {
	it('converts temperature entries to RoastPoints', () => {
		const temps: TemperatureEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				bean_temp: 200,
				environmental_temp: 300,
				data_source: 'live'
			},
			{
				roast_id: 1,
				time_seconds: 30,
				bean_temp: 220,
				environmental_temp: 310,
				data_source: 'live'
			}
		];

		const { roastData } = convertToChartData(temps, []);
		expect(roastData).toHaveLength(2);
		expect(roastData[0].time).toBe(0); // 0 seconds = 0 ms
		expect(roastData[0].bean_temp).toBe(200);
		expect(roastData[1].time).toBe(30000); // 30 seconds = 30000 ms
		expect(roastData[1].bean_temp).toBe(220);
	});

	it('carries forward control values', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 0, bean_temp: 200, data_source: 'live' },
			{ roast_id: 1, time_seconds: 30, bean_temp: 220, data_source: 'live' },
			{ roast_id: 1, time_seconds: 60, bean_temp: 240, data_source: 'live' }
		];

		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '5',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '3',
				event_string: 'heat_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 45,
				event_type: 1,
				event_value: '8',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		const { roastData } = convertToChartData(temps, events);

		// First two points: fan=5
		expect(roastData[0].fan).toBe(5);
		expect(roastData[1].fan).toBe(5);
		// Third point (at 60s): fan updated to 8 at 45s
		expect(roastData[2].fan).toBe(8);
		// Heat stays at 3 throughout
		expect(roastData[0].heat).toBe(3);
		expect(roastData[2].heat).toBe(3);
	});

	it('sets milestone flags on matching time points', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 0, bean_temp: 200, data_source: 'live' },
			{ roast_id: 1, time_seconds: 180, bean_temp: 320, data_source: 'live' }
		];

		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 10,
				event_value: null,
				event_string: 'charge',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 180,
				event_type: 10,
				event_value: null,
				event_string: 'fc_start',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		const { roastData } = convertToChartData(temps, events);
		expect(roastData[0].charge).toBe(true);
		expect(roastData[1].fc_start).toBe(true);
	});

	it('converts milestone events to RoastEvents', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 10,
				event_value: null,
				event_string: 'charge',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 180,
				event_type: 10,
				event_value: null,
				event_string: 'fc_start',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		const { roastEvents } = convertToChartData([], events);
		expect(roastEvents).toHaveLength(2);
		expect(roastEvents[0].name).toBe('Charge');
		expect(roastEvents[1].name).toBe('Fc Start');
		expect(roastEvents[0].time).toBe(0);
		expect(roastEvents[1].time).toBe(180000);
	});

	it('handles empty inputs gracefully', () => {
		const { roastData, roastEvents } = convertToChartData([], []);
		expect(roastData).toHaveLength(0);
		expect(roastEvents).toHaveLength(0);
	});

	it('preserves data_source from temperature entries', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 0, bean_temp: 200, data_source: 'artisan_import' }
		];

		const { roastData } = convertToChartData(temps, []);
		expect(roastData[0].data_source).toBe('artisan_import');
	});

	it('maps dry_end to maillard flag', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 180, bean_temp: 300, data_source: 'live' }
		];
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 180,
				event_type: 10,
				event_value: null,
				event_string: 'dry_end',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		const { roastData } = convertToChartData(temps, events);
		expect(roastData[0].maillard).toBe(true);
	});

	it('maps cool to end flag', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 600, bean_temp: 380, data_source: 'live' }
		];
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 600,
				event_type: 10,
				event_value: null,
				event_string: 'cool',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		const { roastData } = convertToChartData(temps, events);
		expect(roastData[0].end).toBe(true);
	});

	it('defaults fan and heat to 0 when no control events exist', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 30, bean_temp: 220, data_source: 'live' }
		];

		const { roastData } = convertToChartData(temps, []);
		expect(roastData[0].fan).toBe(0);
		expect(roastData[0].heat).toBe(0);
	});
});

// ─── buildEventValueSeries ───────────────────────────────────────────────────

describe('buildEventValueSeries', () => {
	it('groups control events by event_string', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '5',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 30,
				event_type: 1,
				event_value: '8',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			},
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '3',
				event_string: 'heat_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(2);

		const fanSeries = series.find((s) => s.event_string === 'fan_setting');
		expect(fanSeries).toBeDefined();
		expect(fanSeries!.values).toHaveLength(2);
		expect(fanSeries!.min_value).toBe(5);
		expect(fanSeries!.max_value).toBe(8);
	});

	it('ignores milestone events', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 10,
				event_value: null,
				event_string: 'charge',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(0);
	});

	it('ignores events with non-numeric values', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: 'high',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(0);
	});

	it('tracks display_name via mapControlName', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '5',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series[0].display_name).toBeDefined();
		expect(typeof series[0].display_name).toBe('string');
	});
});

// ─── createMilestoneEvents ───────────────────────────────────────────────────

describe('createMilestoneEvents', () => {
	it('creates milestone event with correct structure', () => {
		const { milestoneEvent } = createMilestoneEvents('FC Start', 42, 360000, 8, 5);

		expect(milestoneEvent.event_string).toBe('fc_start');
		expect(milestoneEvent.category).toBe('milestone');
		expect(milestoneEvent.time_seconds).toBe(360);
		expect(milestoneEvent.roast_id).toBe(42);
	});

	it('creates control events for current settings', () => {
		const { controlEvents } = createMilestoneEvents('FC Start', 42, 360000, 8, 5);

		expect(controlEvents).toHaveLength(2);

		const fanEvent = controlEvents.find((e) => e.event_string === 'fan_setting');
		expect(fanEvent).toBeDefined();
		expect(fanEvent!.event_value).toBe('8');

		const heatEvent = controlEvents.find((e) => e.event_string === 'heat_setting');
		expect(heatEvent).toBeDefined();
		expect(heatEvent!.event_value).toBe('5');
	});

	it('sets heat to 0 on Drop event', () => {
		const { controlEvents } = createMilestoneEvents('Drop', 42, 540000, 8, 5);

		const heatEvent = controlEvents.find((e) => e.event_string === 'heat_setting');
		expect(heatEvent!.event_value).toBe('0');
	});

	it('normalizes event names with spaces and caps', () => {
		const { milestoneEvent } = createMilestoneEvents('Cool End', 1, 600000, 0, 0);
		expect(milestoneEvent.event_string).toBe('cool_end');
	});

	it('preserves fan value on Drop event', () => {
		const { controlEvents } = createMilestoneEvents('Drop', 1, 540000, 7, 5);
		const fanEvent = controlEvents.find((e) => e.event_string === 'fan_setting');
		expect(fanEvent!.event_value).toBe('7');
	});
});

// ─── processRawChartData ─────────────────────────────────────────────────────

describe('processRawChartData', () => {
	it('separates temperature, milestone, and control data', () => {
		const rawData = [
			{
				time_milliseconds: 0,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 200,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 0,
				data_type: 'temperature',
				field_name: 'environmental_temp',
				value_numeric: 350,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 0,
				data_type: 'event',
				field_name: 'charge',
				value_numeric: null,
				event_string: 'charge',
				subcategory: 'milestone'
			},
			{
				time_milliseconds: 0,
				data_type: 'event',
				field_name: 'fan_setting',
				value_numeric: 5,
				event_string: 'fan_setting',
				subcategory: 'machine_setting'
			}
		];

		const result = processRawChartData(rawData, 42);

		expect(result.temperatures).toHaveLength(1);
		expect(result.temperatures[0].bean_temp).toBe(200);
		expect(result.temperatures[0].environmental_temp).toBe(350);

		expect(result.milestoneEvents).toHaveLength(1);
		expect(result.milestoneEvents[0].event_string).toBe('charge');

		expect(result.controlEvents).toHaveLength(1);
		expect(result.controlEvents[0].event_string).toBe('fan_setting');
	});

	it('merges temperature fields at the same timestamp', () => {
		const rawData = [
			{
				time_milliseconds: 30000,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 220,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 30000,
				data_type: 'temperature',
				field_name: 'environmental_temp',
				value_numeric: 320,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 30000,
				data_type: 'temperature',
				field_name: 'ambient_temp',
				value_numeric: 72,
				event_string: undefined,
				subcategory: undefined
			}
		];

		const result = processRawChartData(rawData, 1);
		expect(result.temperatures).toHaveLength(1);
		expect(result.temperatures[0].bean_temp).toBe(220);
		expect(result.temperatures[0].environmental_temp).toBe(320);
		expect(result.temperatures[0].ambient_temp).toBe(72);
	});

	it('sorts temperatures by time', () => {
		const rawData = [
			{
				time_milliseconds: 60000,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 240,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 0,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 200,
				event_string: undefined,
				subcategory: undefined
			},
			{
				time_milliseconds: 30000,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 220,
				event_string: undefined,
				subcategory: undefined
			}
		];

		const result = processRawChartData(rawData, 1);
		expect(result.temperatures[0].time_seconds).toBe(0);
		expect(result.temperatures[1].time_seconds).toBe(30);
		expect(result.temperatures[2].time_seconds).toBe(60);
	});

	it('handles milestone data_type directly', () => {
		const rawData: RawChartDataRow[] = [
			makeMilestoneRow(60000, 'charge'),
			makeMilestoneRow(360000, 'fc_start')
		];

		const result = processRawChartData(rawData, 1);
		expect(result.milestoneEvents).toHaveLength(2);
		expect(result.milestoneEvents[0].event_string).toBe('charge');
		expect(result.milestoneEvents[1].event_string).toBe('fc_start');
	});

	it('handles control data_type directly', () => {
		const rawData: RawChartDataRow[] = [
			makeControlRow(0, 'fan_setting', 5),
			makeControlRow(60000, 'heat_setting', 8)
		];

		const result = processRawChartData(rawData, 1);
		expect(result.controlEvents).toHaveLength(2);
		expect(result.controlEvents[0].event_value).toBe('5');
		expect(result.controlEvents[1].event_value).toBe('8');
	});

	it('builds eventValueSeries from control events', () => {
		const rawData: RawChartDataRow[] = [
			makeControlRow(0, 'fan_setting', 5),
			makeControlRow(30000, 'fan_setting', 7),
			makeControlRow(0, 'heat_setting', 8)
		];

		const result = processRawChartData(rawData, 1);
		expect(result.eventValueSeries.length).toBeGreaterThanOrEqual(2);
	});

	it('returns empty arrays for empty input', () => {
		const result = processRawChartData([], 1);
		expect(result.temperatures).toHaveLength(0);
		expect(result.milestoneEvents).toHaveLength(0);
		expect(result.controlEvents).toHaveLength(0);
		expect(result.eventValueSeries).toHaveLength(0);
	});
});

// ─── fetchChartSettings ──────────────────────────────────────────────────────

describe('fetchChartSettings', () => {
	it('returns chart settings in range-tuple format', async () => {
		const fetchFn = mockFetch({
			settings: {
				xRange: [0, 15],
				yRange: [100, 500],
				zRange: [0, 40]
			}
		});

		const result = await fetchChartSettings(42, fetchFn);

		expect(result).not.toBeNull();
		expect(result!.xRange).toEqual([0, 15]);
		expect(result!.yRange).toEqual([100, 500]);
		expect(result!.zRange).toEqual([0, 40]);
	});

	it('normalizes xRange from seconds to minutes when values > 60', async () => {
		const fetchFn = mockFetch({
			settings: {
				xRange: [0, 900], // 900 seconds = 15 minutes
				yRange: [100, 500],
				zRange: [0, 40]
			}
		});

		const result = await fetchChartSettings(42, fetchFn);

		expect(result).not.toBeNull();
		expect(result!.xRange).toEqual([0, 15]); // Normalized to minutes
	});

	it('does not normalize xRange when values are already in minutes (< 60)', async () => {
		const fetchFn = mockFetch({
			settings: {
				xRange: [0, 15],
				yRange: [100, 500],
				zRange: [0, 40]
			}
		});

		const result = await fetchChartSettings(42, fetchFn);
		expect(result!.xRange).toEqual([0, 15]); // Stays as minutes
	});

	it('handles null xRange values without normalizing', async () => {
		const fetchFn = mockFetch({
			settings: {
				xRange: [null, null],
				yRange: [100, 500],
				zRange: [0, 40]
			}
		});

		const result = await fetchChartSettings(42, fetchFn);
		expect(result!.xRange).toEqual([null, null]);
	});

	it('returns null when API returns non-ok status', async () => {
		const fetchFn = mockFetch({}, false);
		const result = await fetchChartSettings(42, fetchFn);
		expect(result).toBeNull();
	});

	it('returns null when no settings in response', async () => {
		const fetchFn = mockFetch({ settings: null });
		const result = await fetchChartSettings(42, fetchFn);
		expect(result).toBeNull();
	});

	it('returns null on network error', async () => {
		const fetchFn = vi
			.fn()
			.mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
		const result = await fetchChartSettings(42, fetchFn);
		expect(result).toBeNull();
	});

	it('calls correct API endpoint with roast ID', async () => {
		const fetchFn = mockFetch({ settings: null });
		await fetchChartSettings(99, fetchFn);
		expect(fetchFn).toHaveBeenCalledWith('/api/roast-chart-settings?roastId=99');
	});
});

// ─── createControlEvents ─────────────────────────────────────────────────────

describe('createControlEvents', () => {
	it('creates fan and heat control events', () => {
		const events = createControlEvents(42, 120000, 7, 5);

		expect(events).toHaveLength(2);

		const fanEvent = events.find((e) => e.event_string === 'fan_setting');
		expect(fanEvent).toBeDefined();
		expect(fanEvent!.event_value).toBe('7');
		expect(fanEvent!.roast_id).toBe(42);
		expect(fanEvent!.time_seconds).toBe(120);
		expect(fanEvent!.category).toBe('control');
		expect(fanEvent!.subcategory).toBe('machine_setting');
		expect(fanEvent!.user_generated).toBe(true);

		const heatEvent = events.find((e) => e.event_string === 'heat_setting');
		expect(heatEvent).toBeDefined();
		expect(heatEvent!.event_value).toBe('5');
	});

	it('converts milliseconds to seconds', () => {
		const events = createControlEvents(1, 90000, 5, 3);
		expect(events[0].time_seconds).toBe(90);
		expect(events[1].time_seconds).toBe(90);
	});

	it('handles zero values', () => {
		const events = createControlEvents(1, 0, 0, 0);
		expect(events[0].event_value).toBe('0');
		expect(events[1].event_value).toBe('0');
		expect(events[0].time_seconds).toBe(0);
	});

	it('handles fractional milliseconds', () => {
		const events = createControlEvents(1, 1500, 5, 3);
		expect(events[0].time_seconds).toBe(1.5);
	});
});

// ─── loadAndProcessRoastData ─────────────────────────────────────────────────

describe('loadAndProcessRoastData', () => {
	it('processes a full roast dataset into chart-ready format', () => {
		const rawData = buildRealisticRoastData();
		const result = loadAndProcessRoastData(rawData, 42);

		// Temperature entries
		expect(result.temperatureEntries.length).toBeGreaterThan(0);
		expect(result.temperatureEntries[0].bean_temp).toBeDefined();

		// Event entries (milestones + controls)
		expect(result.eventEntries.length).toBeGreaterThan(0);
		const milestones = result.eventEntries.filter((e) => e.category === 'milestone');
		const controls = result.eventEntries.filter((e) => e.category === 'control');
		expect(milestones).toHaveLength(4); // charge, dry_end, fc_start, drop
		expect(controls.length).toBeGreaterThanOrEqual(5);

		// Event value series (chart-compatible format)
		expect(result.eventValueSeries.length).toBeGreaterThan(0);
		for (const series of result.eventValueSeries) {
			expect(series.category).toBe('control');
			expect(series.value_range).toBeDefined();
			expect(series.value_range.min).toBeDefined();
			expect(series.value_range.max).toBeDefined();
			expect(series.value_range.detected_scale).toBe('percentage');
		}

		// Roast data (chart points)
		expect(result.roastData.length).toBeGreaterThan(0);
		expect(result.roastData[0].time).toBeDefined();
		expect(result.roastData[0].bean_temp).toBeDefined();

		// Roast events (milestone markers)
		expect(result.roastEvents).toHaveLength(4);
		expect(result.roastEvents[0].name).toBe('Charge');
	});

	it('carries forward fan/heat control values into roast data points', () => {
		const rawData = buildRealisticRoastData();
		const result = loadAndProcessRoastData(rawData, 42);

		// Point at time 0: fan=5, heat=8
		const firstPoint = result.roastData[0];
		expect(firstPoint.fan).toBe(5);
		expect(firstPoint.heat).toBe(8);

		// Point at time 4min (240s): fan should be 7 (updated at 2min), heat=8
		const midPoint = result.roastData.find((d) => d.time === 240000);
		expect(midPoint).toBeDefined();
		expect(midPoint!.fan).toBe(7);
		expect(midPoint!.heat).toBe(8);

		// Point at time 9min (540s/drop): heat should be 0
		const dropPoint = result.roastData.find((d) => d.time === 540000);
		expect(dropPoint).toBeDefined();
		expect(dropPoint!.heat).toBe(0);
	});

	it('sets milestone flags on corresponding data points', () => {
		const rawData = buildRealisticRoastData();
		const result = loadAndProcessRoastData(rawData, 42);

		const chargePoint = result.roastData.find((d) => d.time === 0);
		expect(chargePoint?.charge).toBe(true);

		const fcPoint = result.roastData.find((d) => d.time === 360000);
		expect(fcPoint?.fc_start).toBe(true);

		const dropPoint = result.roastData.find((d) => d.time === 540000);
		expect(dropPoint?.drop).toBe(true);
	});

	it('maps Artisan control names (burner→heat, air→fan)', () => {
		const rawData: RawChartDataRow[] = [
			makeTempRow(0, 'bean_temp', 200),
			makeControlRow(0, 'burner', 80),
			makeControlRow(0, 'air', 50)
		];

		const result = loadAndProcessRoastData(rawData, 1);

		// mapControlName should map burner→heat, air→fan
		const heatSeries = result.eventValueSeries.find((s) => s.event_string === 'heat');
		const fanSeries = result.eventValueSeries.find((s) => s.event_string === 'fan');
		expect(heatSeries).toBeDefined();
		expect(fanSeries).toBeDefined();
	});

	it('creates milestone-only roast data when no temperatures exist', () => {
		const rawData: RawChartDataRow[] = [
			makeMilestoneRow(0, 'charge'),
			makeMilestoneRow(180000, 'dry_end'),
			makeMilestoneRow(360000, 'fc_start'),
			makeMilestoneRow(540000, 'drop')
		];

		const result = loadAndProcessRoastData(rawData, 42);

		// Should create data points from milestones
		expect(result.roastData).toHaveLength(4);
		expect(result.roastData[0].charge).toBe(true);
		expect(result.roastData[0].time).toBe(0);
		expect(result.roastData[0].bean_temp).toBeNull();
		expect(result.roastData[0].heat).toBe(0);
		expect(result.roastData[0].fan).toBe(0);

		// Roast events should also be created
		expect(result.roastEvents).toHaveLength(4);
		expect(result.roastEvents[0].name).toBe('Charge');
		expect(result.roastEvents[3].name).toBe('Drop');
	});

	it('returns empty arrays for empty input', () => {
		const result = loadAndProcessRoastData([], 1);

		expect(result.temperatureEntries).toHaveLength(0);
		expect(result.eventEntries).toHaveLength(0);
		expect(result.eventValueSeries).toHaveLength(0);
		expect(result.roastData).toHaveLength(0);
		expect(result.roastEvents).toHaveLength(0);
	});

	it('sorts event value series by time', () => {
		const rawData: RawChartDataRow[] = [
			makeTempRow(0, 'bean_temp', 200),
			makeControlRow(60000, 'fan_setting', 7),
			makeControlRow(0, 'fan_setting', 5),
			makeControlRow(30000, 'fan_setting', 6)
		];

		const result = loadAndProcessRoastData(rawData, 1);
		const fanSeries = result.eventValueSeries.find((s) => s.event_string === 'fan_setting');
		expect(fanSeries).toBeDefined();
		expect(fanSeries!.values[0].time_seconds).toBe(0);
		expect(fanSeries!.values[1].time_seconds).toBe(30);
		expect(fanSeries!.values[2].time_seconds).toBe(60);
	});

	it('computes correct min/max in event value series', () => {
		const rawData: RawChartDataRow[] = [
			makeTempRow(0, 'bean_temp', 200),
			makeControlRow(0, 'fan_setting', 3),
			makeControlRow(30000, 'fan_setting', 9),
			makeControlRow(60000, 'fan_setting', 5)
		];

		const result = loadAndProcessRoastData(rawData, 1);
		const fanSeries = result.eventValueSeries.find((s) => s.event_string === 'fan_setting');
		expect(fanSeries!.value_range.min).toBe(3);
		expect(fanSeries!.value_range.max).toBe(9);
	});

	it('assigns correct roast_id to all entries', () => {
		const rawData: RawChartDataRow[] = [
			makeTempRow(0, 'bean_temp', 200),
			makeMilestoneRow(0, 'charge'),
			makeControlRow(0, 'fan_setting', 5)
		];

		const result = loadAndProcessRoastData(rawData, 99);

		expect(result.temperatureEntries[0].roast_id).toBe(99);
		for (const event of result.eventEntries) {
			expect(event.roast_id).toBe(99);
		}
	});
});

// ─── fetchRoastChartData ─────────────────────────────────────────────────────

describe('fetchRoastChartData', () => {
	it('returns processed data with metadata', async () => {
		const rawData = [
			{
				time_milliseconds: 0,
				data_type: 'temperature',
				field_name: 'bean_temp',
				value_numeric: 200
			}
		];

		const fetchFn = mockFetch({
			rawData,
			metadata: {
				chargeTime: 5000,
				tempRange: [150, 450],
				rorRange: [-5, 25]
			}
		});

		const result = await fetchRoastChartData(42, fetchFn);

		expect(result).not.toBeNull();
		expect(result!.processed.temperatures).toHaveLength(1);
		expect(result!.metadata.chargeTime).toBe(5000);
		expect(result!.metadata.tempRange).toEqual([150, 450]);
		expect(result!.metadata.rorRange).toEqual([-5, 25]);
	});

	it('returns null on API error', async () => {
		const fetchFn = mockFetch({}, false);
		const result = await fetchRoastChartData(42, fetchFn);
		expect(result).toBeNull();
	});

	it('returns null when rawData is empty', async () => {
		const fetchFn = mockFetch({ rawData: [] });
		const result = await fetchRoastChartData(42, fetchFn);
		expect(result).toBeNull();
	});

	it('returns null when rawData is missing', async () => {
		const fetchFn = mockFetch({});
		const result = await fetchRoastChartData(42, fetchFn);
		expect(result).toBeNull();
	});

	it('uses default metadata values when not provided', async () => {
		const fetchFn = mockFetch({
			rawData: [
				{
					time_milliseconds: 0,
					data_type: 'temperature',
					field_name: 'bean_temp',
					value_numeric: 200
				}
			]
		});

		const result = await fetchRoastChartData(42, fetchFn);
		expect(result!.metadata.chargeTime).toBe(0);
		expect(result!.metadata.tempRange).toEqual([0, 500]);
		expect(result!.metadata.rorRange).toEqual([0, 30]);
	});

	it('calls correct API endpoint', async () => {
		const fetchFn = mockFetch({ rawData: [] });
		await fetchRoastChartData(123, fetchFn);
		expect(fetchFn).toHaveBeenCalledWith('/api/roast-chart-data?roastId=123');
	});
});

// ─── Integration: loadAndProcessRoastData matches convertToChartData ─────────

describe('loadAndProcessRoastData consistency with convertToChartData', () => {
	it('produces equivalent roastData as calling processRawChartData + convertToChartData', () => {
		const rawData: RawChartDataRow[] = [
			makeTempRow(0, 'bean_temp', 200),
			makeTempRow(0, 'environmental_temp', 350),
			makeTempRow(30000, 'bean_temp', 220),
			makeTempRow(30000, 'environmental_temp', 360),
			makeMilestoneRow(0, 'charge'),
			makeMilestoneRow(30000, 'fc_start'),
			makeControlRow(0, 'fan_setting', 5),
			makeControlRow(0, 'heat_setting', 8)
		];

		// Via loadAndProcessRoastData (the new pipeline)
		const pipelineResult = loadAndProcessRoastData(rawData, 42);

		// Via the individual functions (the old manual approach)
		const processed = processRawChartData(rawData, 42);
		const allEvents = [...processed.milestoneEvents, ...processed.controlEvents];
		const directResult = convertToChartData(processed.temperatures, allEvents);

		// The roast data points should match
		expect(pipelineResult.roastData).toHaveLength(directResult.roastData.length);
		for (let i = 0; i < pipelineResult.roastData.length; i++) {
			expect(pipelineResult.roastData[i].time).toBe(directResult.roastData[i].time);
			expect(pipelineResult.roastData[i].bean_temp).toBe(directResult.roastData[i].bean_temp);
			expect(pipelineResult.roastData[i].fan).toBe(directResult.roastData[i].fan);
			expect(pipelineResult.roastData[i].heat).toBe(directResult.roastData[i].heat);
			expect(pipelineResult.roastData[i].charge).toBe(directResult.roastData[i].charge);
			expect(pipelineResult.roastData[i].fc_start).toBe(directResult.roastData[i].fc_start);
		}

		// The roast events should match
		expect(pipelineResult.roastEvents).toHaveLength(directResult.roastEvents.length);
		for (let i = 0; i < pipelineResult.roastEvents.length; i++) {
			expect(pipelineResult.roastEvents[i].time).toBe(directResult.roastEvents[i].time);
			expect(pipelineResult.roastEvents[i].name).toBe(directResult.roastEvents[i].name);
		}
	});
});
