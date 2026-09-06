import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import MatchedPriceComparison from './MatchedPriceComparison.svelte';

const row = (origin = 'Ethiopia', wholesale = false) => ({
	from: '2026-08-07',
	to: '2026-09-06',
	origin,
	wholesale,
	status: 'available',
	changePercent: 10,
	sample: {
		fromListings: 10,
		toListings: 10,
		matchedListings: 5,
		matchedSuppliers: 3,
		matchedCoverage: 0.5
	},
	methodology: 'matched-supplier-median-log-v1',
	canonicalPublication: false
});
const payload = (comparisons = [row()]) => ({
	windowDays: 30,
	from: '2026-08-07',
	to: '2026-09-06',
	comparisons
});
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('automatic 30-day comparisons', () => {
	it('loads raw results immediately and displays exact dates without date inputs', async () => {
		const fetchMock = vi.fn().mockResolvedValue(response(payload()));
		vi.stubGlobal('fetch', fetchMock);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		await screen.findByText('+10.00%');
		expect(screen.getByText('30-day change · 2026-08-07 to 2026-09-06')).toBeInTheDocument();
		expect(screen.getByText('5 coffees · 3 suppliers')).toBeInTheDocument();
		expect(screen.getByText('5 of 10 starting coffees matched (50%)')).toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(document.querySelector('input[type="date"]')).toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/analytics/price-comparisons?wholesale=false',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});
	it('offers only available origins and separates retail and wholesale', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(response(payload([row(), row('Ethiopia', true), row('Brazil')])))
		);
		render(MatchedPriceComparison, { viewMode: 'all' });
		await screen.findByRole('combobox');
		expect(screen.getAllByRole('option').map((x) => x.textContent)).toEqual(['Ethiopia', 'Brazil']);
		expect(screen.getByText('Retail')).toBeInTheDocument();
		expect(screen.getByText('Wholesale')).toBeInTheDocument();
		const select = screen.getByRole('combobox') as HTMLSelectElement;
		select.selectedIndex = 1;
		await fireEvent.change(select);
		expect(screen.queryByText('Wholesale')).not.toBeInTheDocument();
	});
	it('shows one honest empty state without controls or a zero estimate', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(response({ windowDays: 30, from: null, to: null, comparisons: [] }))
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		await screen.findByText(/No 30-day price comparisons/);
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(screen.getByRole('status')).not.toHaveTextContent('0.00%');
	});
	it.each([
		{ data: payload() },
		{ ...payload(), windowDays: 7 },
		{ ...payload(), from: '2026-09-05' },
		payload([{ ...row(), changePercent: null } as unknown as ReturnType<typeof row>]),
		payload([{ ...row(), wholesale: true }])
	])('treats invalid contracts as errors with retry, not no data', async (invalid) => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(invalid))
			.mockResolvedValueOnce(response(payload()));
		vi.stubGlobal('fetch', fetchMock);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		await screen.findByRole('alert');
		expect(screen.queryByText(/No 30-day/)).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		await screen.findByText('+10.00%');
	});
	it('handles transport failures distinctly', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
		render(MatchedPriceComparison, { viewMode: 'retail' });
		await screen.findByRole('alert');
	});
	it('aborts on scope change and ignores a late response even if transport ignores abort', async () => {
		let resolve!: (response: Response) => void;
		const pending = new Promise<Response>((r) => (resolve = r));
		const fetchMock = vi
			.fn()
			.mockReturnValueOnce(pending)
			.mockResolvedValueOnce(response(payload([row('Brazil', true)])));
		vi.stubGlobal('fetch', fetchMock);
		const view = render(MatchedPriceComparison, { viewMode: 'retail' });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const signal = fetchMock.mock.calls[0][1].signal;
		await view.rerender({ viewMode: 'wholesale' });
		await screen.findByText('Brazil');
		expect(signal.aborted).toBe(true);
		resolve(response(payload()));
		await pending;
		await new Promise((r) => setTimeout(r, 0));
		expect(screen.queryByText('Ethiopia')).not.toBeInTheDocument();
	});
	it('aborts outstanding requests on unmount', async () => {
		const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
		vi.stubGlobal('fetch', fetchMock);
		const view = render(MatchedPriceComparison, { viewMode: 'retail' });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		view.unmount();
		expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
	});
});
