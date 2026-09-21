import { describe, expect, it, vi } from 'vitest';
import {
	buildEventValueSeries,
	convertToChartData,
	createControlEvents,
	createMilestoneEvents,
	fetchChartSettings
} from './roast-data';
import type { RoastEventEntry, TemperatureEntry } from './roast-types';

function event(
	eventString: string,
	timeSeconds: number,
	category: RoastEventEntry['category'] = 'control',
	value: string | null = null
): RoastEventEntry {
	return {
		roast_id: 42,
		time_seconds: timeSeconds,
		event_type: category === 'milestone' ? 10 : 1,
		event_value: value,
		event_string: eventString,
		category,
		subcategory: category === 'milestone' ? 'roast_phase' : 'machine_setting',
		user_generated: true,
		automatic: false
	};
}

function mockFetch(data: unknown, ok = true): typeof fetch {
	return vi.fn().mockResolvedValue({
		ok,
		status: ok ? 200 : 500,
		json: () => Promise.resolve(data)
	}) as unknown as typeof fetch;
}

describe('convertToChartData', () => {
	it('converts live temperatures, carries controls, and marks milestones', () => {
		const temperatures: TemperatureEntry[] = [
			{
				roast_id: 42,
				time_seconds: 0,
				bean_temp: 200,
				environmental_temp: 350,
				ambient_temp: 72,
				ror_bean_temp: 5,
				data_source: 'live'
			},
			{
				roast_id: 42,
				time_seconds: 30,
				bean_temp: 220,
				environmental_temp: 360,
				ambient_temp: 73,
				ror_bean_temp: 7,
				data_source: 'live'
			}
		];
		const events = [
			event('charge', 0, 'milestone'),
			event('fc_start', 30, 'milestone'),
			event('fan_setting', 0, 'control', '5'),
			event('heat_setting', 0, 'control', '8')
		];

		const result = convertToChartData(temperatures, events);

		expect(result.roastData[0]).toMatchObject({
			time: 0,
			bean_temp: 200,
			environmental_temp: 350,
			ambient_temp: 72,
			ror_bean_temp: 5,
			fan: 5,
			heat: 8,
			charge: true
		});
		expect(result.roastData[1]).toMatchObject({ fan: 5, heat: 8, fc_start: true });
		expect(result.roastEvents).toEqual([
			{ time: 0, name: 'Charge' },
			{ time: 30_000, name: 'Fc Start' }
		]);
	});

	it('handles empty inputs', () => {
		expect(convertToChartData([], [])).toEqual({ roastData: [], roastEvents: [] });
	});
});

describe('buildEventValueSeries', () => {
	it('groups numeric controls, maps Artisan names, and tracks ranges', () => {
		const series = buildEventValueSeries([
			event('air', 30, 'control', '60'),
			event('air', 0, 'control', '40'),
			event('burner', 0, 'control', '80'),
			event('charge', 0, 'milestone')
		]);

		expect(series).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event_string: 'air',
					display_name: 'Fan',
					min_value: 40,
					max_value: 60,
					values: [
						{ time_seconds: 30, value: 60 },
						{ time_seconds: 0, value: 40 }
					]
				}),
				expect.objectContaining({ event_string: 'burner', display_name: 'Heat' })
			])
		);
	});

	it('ignores non-numeric and milestone events', () => {
		expect(
			buildEventValueSeries([
				event('fan_setting', 0, 'control', 'unknown'),
				event('charge', 0, 'milestone', '10')
			])
		).toEqual([]);
	});
});

describe('live event creation', () => {
	it('creates normalized milestone and control snapshots', () => {
		const result = createMilestoneEvents('Cool End', 42, 600_000, 7, 5);

		expect(result.milestoneEvent).toMatchObject({
			time_seconds: 600,
			event_string: 'cool_end',
			category: 'milestone'
		});
		expect(result.controlEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ event_string: 'fan_setting', event_value: '7' }),
				expect.objectContaining({ event_string: 'heat_setting', event_value: '5' })
			])
		);
	});

	it('drops heat to zero at the drop milestone', () => {
		const result = createMilestoneEvents('Drop', 42, 540_000, 7, 5);
		expect(
			result.controlEvents.find((entry) => entry.event_string === 'heat_setting')
		).toMatchObject({ event_value: '0' });
	});

	it('creates direct fan and heat changes in seconds', () => {
		expect(createControlEvents(42, 1_500, 7, 5)).toEqual([
			expect.objectContaining({ time_seconds: 1.5, event_string: 'fan_setting', event_value: '7' }),
			expect.objectContaining({ time_seconds: 1.5, event_string: 'heat_setting', event_value: '5' })
		]);
	});
});

describe('fetchChartSettings', () => {
	it('normalizes persisted second ranges to chart minutes', async () => {
		const fetchFn = mockFetch({
			settings: { xRange: [0, 900], yRange: [100, 500], zRange: [0, 40] }
		});

		await expect(fetchChartSettings(42, fetchFn)).resolves.toEqual({
			xRange: [0, 15],
			yRange: [100, 500],
			zRange: [0, 40]
		});
		expect(fetchFn).toHaveBeenCalledWith('/api/roast-chart-settings?roastId=42');
	});

	it('preserves null ranges', async () => {
		await expect(
			fetchChartSettings(
				42,
				mockFetch({ settings: { xRange: [null, null], yRange: [0, 250], zRange: [-5, 30] } })
			)
		).resolves.toEqual({ xRange: [null, null], yRange: [0, 250], zRange: [-5, 30] });
	});

	it('returns null for missing, failed, or rejected responses', async () => {
		await expect(fetchChartSettings(42, mockFetch({ settings: null }))).resolves.toBeNull();
		await expect(fetchChartSettings(42, mockFetch({}, false))).resolves.toBeNull();
		await expect(
			fetchChartSettings(
				42,
				vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch
			)
		).resolves.toBeNull();
	});
});
