import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/svelte';
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
		await screen.findByText('+10.00%');
		expect(screen.getByText('30-day change · 2026-08-07 to 2026-09-06')).toBeInTheDocument();
		expect(
			screen.getByText(/5 of 10 starting coffees matched \(50%\) · 3 suppliers/)
		).toBeInTheDocument();
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
		await screen.findByRole('list', { name: '30-day price signals' });
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(screen.getByText('Brazil (Retail)')).toBeInTheDocument();
		expect(screen.getByText('Ethiopia (Retail)')).toBeInTheDocument();
		expect(screen.getByText('Ethiopia (Wholesale)')).toBeInTheDocument();
		expect(screen.getAllByText('+10.00%')).toHaveLength(3);
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
		expect(
			screen.getByText(/notable for this origin, 92nd percentile of the last 12 weeks/)
		).toBeInTheDocument();
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
		expect(screen.getByText(/history building \(1 of 8 weeks\)/)).toBeInTheDocument();
		expect(screen.getByText(/history building \(0 of 8 weeks\)/)).toBeInTheDocument();
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
