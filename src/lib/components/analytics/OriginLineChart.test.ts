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
	it('shows exact prices and dates without inventing a recorded gap price', async () => {
		render(OriginLineChart, { snapshots, expanded: true });
		await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
		await fireEvent.focus(screen.getByRole('slider'));
		expect(screen.getByText('$11.62')).toBeInTheDocument();
		expect(screen.queryByText('120 prices · 4 suppliers')).not.toBeInTheDocument();
		const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
		expect(slider).toHaveAttribute('min', String(+new Date('2026-07-15')));
		expect(slider).toHaveAttribute('aria-valuetext', 'Sep 7, 2026 · UTC');
		await fireEvent.input(slider, { target: { value: +new Date('2026-08-15') } });
		expect(slider).toHaveAttribute('aria-valuetext', 'Aug 15, 2026 · UTC');
		expect(screen.getAllByText('Aug 15, 2026 · UTC')[0]).toBeInTheDocument();
		expect(screen.getByText('No data')).toBeInTheDocument();
		expect(screen.queryByText('$11.62')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Close price inspection' }));
		expect(screen.queryByLabelText('Price inspection')).not.toBeInTheDocument();
	});

	it('keeps modeled earlier history out of the recorded comparison', async () => {
		const legacy = Array.from({ length: 6 }, (_, i) =>
			row(new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString().slice(0, 10), true)
		);
		render(OriginLineChart, { snapshots: [...legacy, ...snapshots], expanded: true });
		const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
		expect(slider).toHaveAttribute('min', String(+new Date('2026-01-01')));
		await fireEvent.input(slider, { target: { value: +new Date('2026-02-01') } });
		expect(screen.getByText('est.')).toBeInTheDocument();
		expect(screen.queryByText(/120 prices/)).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
		expect(slider).toHaveAttribute('min', String(+new Date('2026-07-15')));
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
	});
});

it('defaults to continuous estimates and retains inspection when switching to recorded prices', async () => {
	render(OriginLineChart, { snapshots, expanded: true });
	expect(screen.getByRole('button', { name: 'Trend', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	const slider = screen.getByRole('slider', { name: 'Inspect observation date' });
	await fireEvent.input(slider, { target: { value: +new Date('2026-08-15') } });
	expect(screen.getByText('est.')).toBeInTheDocument();
	expect(screen.queryByText(/42-day interval/)).not.toBeInTheDocument();
	expect(screen.queryByText('120 prices · 4 suppliers')).not.toBeInTheDocument();
	await fireEvent.click(screen.getByRole('button', { name: 'Recorded prices' }));
	expect(screen.getByText('No data')).toBeInTheDocument();
});

it('keeps dashboard evidence on demand and reserves detailed controls for expansion', async () => {
	const view = render(OriginLineChart, { snapshots });
	expect(screen.queryByRole('button', { name: 'Recorded prices' })).not.toBeInTheDocument();
	expect(screen.queryByLabelText('Price inspection')).not.toBeInTheDocument();
	await fireEvent.input(screen.getByRole('slider'), { target: { value: +new Date('2026-08-15') } });
	expect(screen.getByLabelText('Price inspection')).toBeInTheDocument();
	expect(screen.getByText('est.')).toBeInTheDocument();
	expect(screen.queryByText(/42-day interval/)).not.toBeInTheDocument();
	await view.rerender({ snapshots, expanded: true });
	expect(screen.queryByText(/42-day interval/)).not.toBeInTheDocument();
	expect(
		screen.getByText('About this data · Includes estimates').closest('details')
	).not.toHaveAttribute('open');
	expect(screen.getByRole('button', { name: 'Recorded prices' })).toBeInTheDocument();
	await fireEvent.keyDown(window, { key: 'Escape' });
	expect(screen.queryByLabelText('Price inspection')).not.toBeInTheDocument();
});
