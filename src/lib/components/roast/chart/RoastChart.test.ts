import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RoastChart from './RoastChart.svelte';
import type { ProcessedChartData } from './chart-types';

const chartData: ProcessedChartData = {
	temperaturePoints: [
		{ timeMinutes: 0, value: 200 },
		{ timeMinutes: 1, value: 250 }
	],
	envTempPoints: [],
	rorPoints: [],
	controlSeries: [],
	series: [
		{
			id: 'bean-temperature',
			label: 'Bean Temp (BT)',
			kind: 'bean_temperature',
			unit: '°F',
			axis: 'temperature',
			color: '#f59e0b',
			strokeWidth: 3,
			curve: 'basis',
			points: [
				{ timeMinutes: 0, value: 200 },
				{ timeMinutes: 1, value: 250 }
			]
		},
		{
			id: 'ambient-temperature',
			label: 'Ambient Temp',
			kind: 'ambient_temperature',
			unit: '°F',
			axis: 'temperature',
			color: '#0f766e',
			strokeWidth: 2,
			curve: 'basis',
			points: [
				{ timeMinutes: 0, value: 72 },
				{ timeMinutes: 1, value: 74 }
			]
		}
	],
	events: [{ timeMinutes: 0, name: 'charge' }],
	chargeTime: 0,
	temperatureUnit: '°F',
	xDomain: [-2, 12],
	yTempDomain: [50, 500],
	yRorDomain: [0, 50]
};

describe('RoastChart', () => {
	it('renders accessible unit-labelled series controls and toggles visibility', async () => {
		render(RoastChart, { chartData });

		const ambient = screen.getByRole('button', { name: 'Ambient Temp (°F)' });
		expect(ambient).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(ambient);

		expect(ambient).toHaveAttribute('aria-pressed', 'false');
	});

	it('labels milestones with short horizontal text', () => {
		const { container } = render(RoastChart, {
			chartData: {
				...chartData,
				events: [
					{ timeMinutes: 0, name: 'charge' },
					{ timeMinutes: 5, name: 'dry_end' },
					{ timeMinutes: 4.25, name: 'dry_end', label: 'B Dry end', dashed: true }
				]
			}
		});

		const labels = [...container.querySelectorAll('.chart-milestone-label')];
		// The test DOM has no layout width, so only the text matters here, not its order.
		expect(labels.map((label) => label.textContent?.trim()).sort()).toEqual([
			'B Dry end',
			'Charge',
			'Dry end'
		]);
		expect(labels.every((label) => !label.hasAttribute('transform'))).toBe(true);
	});

	it('breaks a line where a reading is missing', () => {
		const { container } = render(RoastChart, {
			chartData: {
				...chartData,
				series: [
					{
						...chartData.series[0],
						curve: 'linear',
						points: [
							{ timeMinutes: 0, value: 200 },
							{ timeMinutes: 1, value: 250 },
							{ timeMinutes: 3, value: 300, gapBefore: true },
							{ timeMinutes: 4, value: 320 }
						]
					}
				]
			}
		});

		const path = container.querySelector('.chart-series-bean_temperature')?.getAttribute('d') ?? '';
		expect(path.match(/M/g)).toHaveLength(2);
	});
});
