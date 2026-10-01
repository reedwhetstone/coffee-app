import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import MatchedPriceComparison from './MatchedPriceComparison.svelte';

const row = (origin = 'Ethiopia', wholesale = false, changePercent = 10) => ({
	from: '2026-08-07',
	to: '2026-09-06',
	origin,
	wholesale,
	status: 'available',
	changePercent,
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
const payload = (comparisons: object[] = [row()]) => ({
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
		const list = await screen.findByRole('list', { name: '30-day price signals' });
		expect(within(list).getByText('+10.00%')).toBeInTheDocument();
		expect(screen.getByText(/Aug 7 – Sep 6, 2026/)).toBeInTheDocument();
		const table = screen.getByRole('table', { name: '30-day same-coffee price change by origin' });
		const [, dataRow] = within(table).getAllByRole('row');
		expect(dataRow).toHaveTextContent('Ethiopia');
		expect(dataRow).toHaveTextContent('5/10');
		expect(dataRow).toHaveTextContent('(50%)');
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(document.querySelector('input[type="date"]')).toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/analytics/price-comparisons?wholesale=false',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});
	it('shows both years when the window crosses New Year', async () => {
		const crossing = (data: Record<string, unknown>) => ({
			...data,
			from: '2026-12-15',
			to: '2027-01-14'
		});
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(response({ ...crossing(payload()), comparisons: [crossing(row())] }))
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		expect(await screen.findByText(/Dec 15, 2026 – Jan 14, 2027/)).toBeInTheDocument();
	});
	it('offers only available origins and separates retail and wholesale', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(response(payload([row(), row('Ethiopia', true), row('Brazil')])))
		);
		render(MatchedPriceComparison, { viewMode: 'all' });
		const list = await screen.findByRole('list', { name: '30-day price signals' });
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(within(list).getByText('Brazil (Retail)')).toBeInTheDocument();
		expect(within(list).getByText('Ethiopia (Retail)')).toBeInTheDocument();
		expect(within(list).getByText('Ethiopia (Wholesale)')).toBeInTheDocument();
		expect(within(list).getAllByText('+10.00%')).toHaveLength(3);
		// The table keeps the markets on separate rows.
		const table = screen.getByRole('table', { name: '30-day same-coffee price change by origin' });
		expect(within(table).getAllByText('Wholesale')).toHaveLength(1);
		expect(within(table).getAllByText('Retail')).toHaveLength(2);
		// The summary counts distinct origins, not origin-market rows.
		expect(screen.getByText('All 2 origins')).toBeInTheDocument();
	});
	it('keeps moves under 2% out of the headline strip', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					response(
						payload([
							row('Ethiopia', false, 0.34),
							row('Rwanda', false, 1.29),
							row('Peru', false, -3.1)
						])
					)
				)
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		const list = await screen.findByRole('list', { name: '30-day price signals' });
		expect(list).toHaveTextContent('Peru');
		expect(list).not.toHaveTextContent('Rwanda');
		expect(screen.getByText('2 other origins moved less than 2%.')).toBeInTheDocument();
	});
	it('says plainly when no origin moved 2% or more', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					response(payload([row('Ethiopia', false, 0.34), row('Rwanda', false, 1.29)]))
				)
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		await screen.findByText(/No origin moved 2% or more/);
		expect(screen.getByText('Rwanda +1.29%')).toBeInTheDocument();
		expect(screen.queryByRole('list', { name: '30-day price signals' })).toBeNull();
	});
	it("uses each origin's own baseline once Parchment can judge it", async () => {
		const judged = (
			origin: string,
			change: number,
			classification: string,
			movePercentile: number
		) => ({
			...row(origin, false, change),
			significance: {
				method: 'matched-30d-weekly-abs-percentile-v1',
				baselineWindows: 12,
				requiredBaselineWindows: 8,
				baselineMedianAbsChangePercent: 0.4,
				movePercentile,
				classification
			}
		});
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					response(
						payload([
							judged('Kenya', 1.5, 'notable', 91.7),
							judged('Vietnam', 2.5, 'quiet', 10),
							judged('Peru', -0.2, 'normal', 50)
						])
					)
				)
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		const list = await screen.findByRole('list', { name: '30-day price signals' });
		// A 1.5% move that is unusual for Kenya is shown; a routine 2.5% move is not.
		expect(list).toHaveTextContent('Kenya');
		expect(list).toHaveTextContent('notable');
		expect(list).not.toHaveTextContent('Vietnam');
		expect(
			screen.getByText(/2 other origins\s+stayed within their normal range/)
		).toBeInTheDocument();
		expect(screen.queryByText(/Until an origin has eight weeks/)).toBeNull();
		// The evidence is visible in the cell, not hidden behind a hover title.
		const table = screen.getByRole('table', { name: '30-day same-coffee price change by origin' });
		const kenyaRow = within(table).getByRole('row', { name: /Kenya/ });
		expect(kenyaRow).toHaveTextContent('notable');
		expect(kenyaRow).toHaveTextContent('92nd percentile of last 12 wk');
		expect(table.querySelector('[title]')).toBeNull();
		expect(screen.getByRole('columnheader', { name: 'For this origin' })).toBeInTheDocument();
	});
	it('labels the interim size cutoff while history is still building', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				response(
					payload([
						{
							...row('Rwanda', false, 2.9),
							significance: {
								method: 'matched-30d-weekly-abs-percentile-v1',
								baselineWindows: 1,
								requiredBaselineWindows: 8,
								baselineMedianAbsChangePercent: 2.9,
								movePercentile: null,
								classification: null
							}
						},
						row('Ethiopia', false, 0.34)
					])
				)
			)
		);
		render(MatchedPriceComparison, { viewMode: 'retail' });
		const list = await screen.findByRole('list', { name: '30-day price signals' });
		expect(list).toHaveTextContent('Rwanda');
		expect(
			screen.getByText(/Until an origin has eight weeks of matched history/)
		).toBeInTheDocument();
		// No origin can be judged yet, so the per-origin read column is omitted.
		expect(screen.queryByRole('columnheader', { name: 'For this origin' })).toBeNull();
		const table = screen.getByRole('table', { name: '30-day same-coffee price change by origin' });
		expect(within(table).getAllByRole('row')).toHaveLength(3);
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
		await screen.findAllByText('+10.00%');
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
		await screen.findAllByText('Brazil');
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
