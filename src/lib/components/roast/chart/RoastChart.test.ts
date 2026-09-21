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
});
