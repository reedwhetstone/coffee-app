import { describe, it, expect } from 'vitest';
import {
	convertToChartData,
	buildEventValueSeries,
	createMilestoneEvents,
	processRawChartData
} from './roast-data';
import type { TemperatureEntry, RoastEventEntry } from './roast-types';

// ─── convertToChartData ──────────────────────────────────────────────────────

describe('convertToChartData', () => {
	it('converts temperature entries to RoastPoints', () => {
		const temps: TemperatureEntry[] = [
			{ roast_id: 1, time_seconds: 0, bean_temp: 200, environmental_temp: 300, data_source: 'live' },
			{ roast_id: 1, time_seconds: 30, bean_temp: 220, environmental_temp: 310, data_source: 'live' }
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
				roast_id: 1, time_seconds: 0, event_type: 1, event_value: '5',
				event_string: 'fan_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 0, event_type: 1, event_value: '3',
				event_string: 'heat_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 45, event_type: 1, event_value: '8',
				event_string: 'fan_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
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
				roast_id: 1, time_seconds: 0, event_type: 10, event_value: null,
				event_string: 'charge', category: 'milestone', subcategory: 'roast_phase',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 180, event_type: 10, event_value: null,
				event_string: 'fc_start', category: 'milestone', subcategory: 'roast_phase',
				user_generated: true, automatic: false
			}
		];

		const { roastData } = convertToChartData(temps, events);
		expect(roastData[0].charge).toBe(true);
		expect(roastData[1].fc_start).toBe(true);
	});

	it('converts milestone events to RoastEvents', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1, time_seconds: 0, event_type: 10, event_value: null,
				event_string: 'charge', category: 'milestone', subcategory: 'roast_phase',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 180, event_type: 10, event_value: null,
				event_string: 'fc_start', category: 'milestone', subcategory: 'roast_phase',
				user_generated: true, automatic: false
			}
		];

		const { roastEvents } = convertToChartData([], events);
		expect(roastEvents).toHaveLength(2);
		expect(roastEvents[0].name).toBe('Charge');
		expect(roastEvents[1].name).toBe('Fc Start');
		expect(roastEvents[0].time).toBe(0);
		expect(roastEvents[1].time).toBe(180000);
	});
});

// ─── buildEventValueSeries ───────────────────────────────────────────────────

describe('buildEventValueSeries', () => {
	it('groups control events by event_string', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1, time_seconds: 0, event_type: 1, event_value: '5',
				event_string: 'fan_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 30, event_type: 1, event_value: '8',
				event_string: 'fan_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			},
			{
				roast_id: 1, time_seconds: 0, event_type: 1, event_value: '3',
				event_string: 'heat_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(2);

		const fanSeries = series.find(s => s.event_string === 'fan_setting');
		expect(fanSeries).toBeDefined();
		expect(fanSeries!.values).toHaveLength(2);
		expect(fanSeries!.min_value).toBe(5);
		expect(fanSeries!.max_value).toBe(8);
	});

	it('ignores milestone events', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1, time_seconds: 0, event_type: 10, event_value: null,
				event_string: 'charge', category: 'milestone', subcategory: 'roast_phase',
				user_generated: true, automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(0);
	});

	it('ignores events with non-numeric values', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1, time_seconds: 0, event_type: 1, event_value: 'high',
				event_string: 'fan_setting', category: 'control', subcategory: 'machine_setting',
				user_generated: true, automatic: false
			}
		];

		const series = buildEventValueSeries(events);
		expect(series).toHaveLength(0);
	});
});

// ─── createMilestoneEvents ───────────────────────────────────────────────────

describe('createMilestoneEvents', () => {
	it('creates milestone event with correct structure', () => {
		const { milestoneEvent } = createMilestoneEvents(
			'FC Start', 42, 360000, 8, 5
		);

		expect(milestoneEvent.event_string).toBe('fc_start');
		expect(milestoneEvent.category).toBe('milestone');
		expect(milestoneEvent.time_seconds).toBe(360);
		expect(milestoneEvent.roast_id).toBe(42);
	});

	it('creates control events for current settings', () => {
		const { controlEvents } = createMilestoneEvents(
			'FC Start', 42, 360000, 8, 5
		);

		expect(controlEvents).toHaveLength(2);

		const fanEvent = controlEvents.find(e => e.event_string === 'fan_setting');
		expect(fanEvent).toBeDefined();
		expect(fanEvent!.event_value).toBe('8');

		const heatEvent = controlEvents.find(e => e.event_string === 'heat_setting');
		expect(heatEvent).toBeDefined();
		expect(heatEvent!.event_value).toBe('5');
	});

	it('sets heat to 0 on Drop event', () => {
		const { controlEvents } = createMilestoneEvents(
			'Drop', 42, 540000, 8, 5
		);

		const heatEvent = controlEvents.find(e => e.event_string === 'heat_setting');
		expect(heatEvent!.event_value).toBe('0');
	});
});

// ─── processRawChartData ─────────────────────────────────────────────────────

describe('processRawChartData', () => {
	it('separates temperature, milestone, and control data', () => {
		const rawData = [
			{ time_milliseconds: 0, data_type: 'temperature', field_name: 'bean_temp', value_numeric: 200, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 0, data_type: 'temperature', field_name: 'environmental_temp', value_numeric: 350, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 0, data_type: 'event', field_name: 'charge', value_numeric: null, event_string: 'charge', subcategory: 'milestone' },
			{ time_milliseconds: 0, data_type: 'event', field_name: 'fan_setting', value_numeric: 5, event_string: 'fan_setting', subcategory: 'machine_setting' }
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
			{ time_milliseconds: 30000, data_type: 'temperature', field_name: 'bean_temp', value_numeric: 220, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 30000, data_type: 'temperature', field_name: 'environmental_temp', value_numeric: 320, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 30000, data_type: 'temperature', field_name: 'ambient_temp', value_numeric: 72, event_string: undefined, subcategory: undefined }
		];

		const result = processRawChartData(rawData, 1);
		expect(result.temperatures).toHaveLength(1);
		expect(result.temperatures[0].bean_temp).toBe(220);
		expect(result.temperatures[0].environmental_temp).toBe(320);
		expect(result.temperatures[0].ambient_temp).toBe(72);
	});

	it('sorts temperatures by time', () => {
		const rawData = [
			{ time_milliseconds: 60000, data_type: 'temperature', field_name: 'bean_temp', value_numeric: 240, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 0, data_type: 'temperature', field_name: 'bean_temp', value_numeric: 200, event_string: undefined, subcategory: undefined },
			{ time_milliseconds: 30000, data_type: 'temperature', field_name: 'bean_temp', value_numeric: 220, event_string: undefined, subcategory: undefined }
		];

		const result = processRawChartData(rawData, 1);
		expect(result.temperatures[0].time_seconds).toBe(0);
		expect(result.temperatures[1].time_seconds).toBe(30);
		expect(result.temperatures[2].time_seconds).toBe(60);
	});
});
