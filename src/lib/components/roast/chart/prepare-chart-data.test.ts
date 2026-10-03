import { describe, expect, it } from 'vitest';
import { prepareChartData } from './prepare-chart-data';

describe('recording-start fallback for charts without CHARGE', () => {
	it('does not move the axis to the first surviving temperature reading', () => {
		const chart = prepareChartData({
			roastData: [
				{ time: 60_000, bean_temp: 280, environmental_temp: null, heat: 0, fan: 0 },
				{ time: 120_000, bean_temp: 320, environmental_temp: null, heat: 0, fan: 0 }
			],
			events: [
				{
					time_seconds: 90,
					event_type: 10,
					event_value: null,
					event_string: 'dry_end',
					category: 'milestone'
				}
			],
			roastEvents: [],
			savedEventValueSeries: [],
			chartSettings: null,
			isDuringRoasting: false
		});
		expect(chart.chargeTime).toBe(0);
		expect(chart.temperaturePoints.map((point) => point.timeMinutes)).toEqual([1, 2]);
		expect(chart.events.find((event) => event.name === 'dry_end')?.timeMinutes).toBe(1.5);
	});
});
