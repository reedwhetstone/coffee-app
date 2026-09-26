import { describe, expect, it, vi } from 'vitest';
import type { RoastChartData } from '@purveyors/sdk';
import {
	buildRoastChartModel,
	chartEventsToRoastEntries,
	fetchRoastChartModel
} from './roast-chart-model';

function fixture(): RoastChartData {
	return {
		points: [],
		series: [
			{
				id: 'bean-temperature',
				name: 'BT',
				kind: 'bean_temperature',
				unit: 'C',
				device_index: null,
				channel: null,
				total_points: 3,
				sampled_points: 3,
				points: [
					{ time_milliseconds: 0, value_numeric: 25 },
					{ time_milliseconds: 60_000, value_numeric: 90 },
					{ time_milliseconds: 120_000, value_numeric: 140 }
				]
			},
			{
				id: 'ambient-temperature',
				name: 'Ambient',
				kind: 'ambient_temperature',
				unit: 'C',
				device_index: null,
				channel: null,
				total_points: 2,
				sampled_points: 2,
				points: [
					{ time_milliseconds: 0, value_numeric: 21 },
					{ time_milliseconds: 120_000, value_numeric: 24 }
				]
			},
			{
				id: 'bean-ror',
				name: 'RoR',
				kind: 'rate_of_rise',
				unit: 'C/min',
				device_index: null,
				channel: null,
				total_points: 2,
				sampled_points: 2,
				points: [
					{ time_milliseconds: 60_000, value_numeric: 12 },
					{ time_milliseconds: 120_000, value_numeric: 8 }
				]
			},
			{
				id: 'drum-pressure',
				name: 'Drum pressure',
				kind: 'auxiliary',
				unit: 'Pa',
				device_index: 1,
				channel: 2,
				total_points: 2,
				sampled_points: 2,
				points: [
					{ time_milliseconds: 0, value_numeric: 8 },
					{ time_milliseconds: 120_000, value_numeric: 12 }
				]
			}
		],
		events: [
			{
				time_milliseconds: 30_000,
				name: 'charge',
				value: null,
				category: 'milestone',
				subcategory: 'roast_phase'
			},
			{
				time_milliseconds: 90_000,
				name: 'fc_start',
				value: null,
				category: 'milestone',
				subcategory: 'roast_phase'
			},
			{
				time_milliseconds: 30_000,
				name: 'fan_setting',
				value: '35',
				category: 'control',
				subcategory: 'machine_setting'
			},
			{
				time_milliseconds: 90_000,
				name: 'fan_setting',
				value: '55',
				category: 'control',
				subcategory: 'machine_setting'
			}
		],
		metadata: {
			revision: null,
			total_data_points: 3,
			sampled_data_points: 3,
			roast_duration_minutes: 2,
			time_min_ms: 0,
			time_max_ms: 120_000,
			temp_min: 21,
			temp_max: 140,
			ror_min: null,
			ror_max: null,
			charge_time_ms: 30_000,
			temperature_unit: 'C',
			profile_schema_version: 1,
			target_points: 400,
			sample_gap_max_ms: 60_000
		}
	};
}

describe('buildRoastChartModel', () => {
	it('builds one unit-aware model for primary, ambient, auxiliary, control, and milestone data', () => {
		const model = buildRoastChartModel(fixture());

		expect(model.temperatureUnit).toBe('°C');
		expect(model.temperaturePoints[0]).toEqual({ timeMinutes: -0.5, value: 25 });
		expect(model.events).toEqual([
			{ timeMinutes: 0, name: 'charge' },
			{ timeMinutes: 1, name: 'fc_start' }
		]);
		expect(model.series).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'ambient-temperature', axis: 'temperature', unit: '°C' }),
				expect.objectContaining({ id: 'bean-ror', axis: 'ror', unit: '°C/min' }),
				expect.objectContaining({ id: 'drum-pressure', axis: 'control', unit: 'Pa' }),
				expect.objectContaining({ id: 'control-fan_setting', curve: 'stepAfter' })
			])
		);
	});

	it('preserves saved chart domains when supplied', () => {
		const model = buildRoastChartModel(fixture(), {
			xRange: [-1, 14],
			yRange: [0, 250],
			zRange: [-5, 30]
		});

		expect(model.xDomain).toEqual([-1, 14]);
		expect(model.yTempDomain).toEqual([0, 250]);
		expect(model.yRorDomain).toEqual([-5, 30]);
	});

	it('uses primary series units and includes machine and percentage controls in their time bounds', () => {
		const data = fixture();
		data.metadata.temperature_unit = null;
		data.events.push(
			{
				time_milliseconds: -30_000,
				name: 'heat_setting',
				value: '75%',
				category: 'machine',
				subcategory: 'machine_setting'
			},
			{
				time_milliseconds: 180_000,
				name: 'heat_setting',
				value: '25%',
				category: 'machine',
				subcategory: 'machine_setting'
			}
		);

		const model = buildRoastChartModel(data);
		const heat = model.series.find((series) => series.id === 'control-heat_setting');

		expect(model.temperatureUnit).toBe('°C');
		expect(heat?.points[0]).toEqual({ timeMinutes: -1, value: 75 });
		expect(heat?.points.at(-1)).toEqual({ timeMinutes: 2.5, value: 25 });
	});
});

describe('saved roast chart loading', () => {
	it('fetches the canonical BFF contract and builds the shared model', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(fixture()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const loaded = await fetchRoastChartModel(42, fetchFn);

		expect(fetchFn).toHaveBeenCalledWith('/api/roast-chart-data?roastId=42');
		expect(loaded?.chartData.series.some((series) => series.id === 'drum-pressure')).toBe(true);
	});

	it('converts canonical events for existing phase calculations', () => {
		const entries = chartEventsToRoastEntries(fixture().events, 42);

		expect(entries[0]).toMatchObject({
			roast_id: 42,
			time_seconds: 30,
			event_type: 10,
			event_string: 'charge'
		});
		expect(entries[2]).toMatchObject({ event_type: 1, event_value: '35' });
	});
});
