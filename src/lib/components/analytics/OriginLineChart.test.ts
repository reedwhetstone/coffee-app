import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import OriginLineChart from './OriginLineChart.svelte';

afterEach(cleanup);
const row = (snapshot_date: string, synthetic = false) => ({
	snapshot_date,
	origin: 'Colombia',
	price_avg: 14,
	price_median: 11.62,
	price_min: 8,
	price_max: 20,
	price_p25: 9,
	price_p75: 13,
	sample_size: 120,
	supplier_count: 4,
	wholesale_only: false,
	synthetic
});
const snapshots = [
	...Array.from({ length: 7 }, (_, i) => row(`2026-07-${15 + i}`)),
	...Array.from({ length: 7 }, (_, i) => row(`2026-09-0${i + 1}`)),
	row('2026-03-01', true)
];

describe('origin trend inspection', () => {
	it('shows real dates, median labels and cohort sizes without inventing a gap price', async () => {
		render(OriginLineChart, { snapshots });
		await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
		expect(screen.getByText('$11.62')).toBeInTheDocument();
		expect(screen.getByText('Sep 7, 2026 · Median')).toBeInTheDocument();
		expect(screen.getByText('120 prices · 4 suppliers')).toBeInTheDocument();
		const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
		expect(slider).toHaveAttribute('min', String(+new Date('2026-07-15')));
		expect(slider).toHaveAttribute('aria-valuetext', 'Sep 7, 2026 · UTC');
		await fireEvent.input(slider, { target: { value: +new Date('2026-08-15') } });
		expect(slider).toHaveAttribute('aria-valuetext', 'Aug 15, 2026 · UTC');
		expect(screen.getByText('Aug 15, 2026 · UTC')).toBeInTheDocument();
		expect(screen.getByText('No published index')).toBeInTheDocument();
		expect(screen.queryByText('$11.62')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Latest' }));
		expect(screen.getByText('$11.62')).toBeInTheDocument();
	});

	it('excludes synthetic history by default and identifies it when explicitly included', async () => {
		render(OriginLineChart, { snapshots });
		await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
		await fireEvent.click(screen.getByRole('checkbox', { name: /Include historical estimates/ }));
		const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
		expect(slider).toHaveAttribute('min', String(+new Date('2026-03-01')));
		await fireEvent.input(slider, { target: { value: +new Date('2026-03-01') } });
		expect(screen.getByText('Median · Historical estimate')).toBeInTheDocument();
	});
});

it('defaults to continuous estimates and retains inspection when switching to recorded prices', async () => {
	render(OriginLineChart, { snapshots });
	expect(screen.getByRole('button', { name: 'Reconstructed trend' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
	await fireEvent.input(slider, { target: { value: +new Date('2026-08-15') } });
	expect(screen.getByText('Trend estimate')).toBeInTheDocument();
	expect(screen.getByText(/42-day interval/)).toBeInTheDocument();
	expect(screen.queryByText('120 prices · 4 suppliers')).not.toBeInTheDocument();
	await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
	expect(screen.getByText('No published index')).toBeInTheDocument();
});
