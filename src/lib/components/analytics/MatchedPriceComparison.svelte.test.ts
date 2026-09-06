import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import MatchedPriceComparison from './MatchedPriceComparison.svelte';

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function availableResponse() {
	return new Response(
		JSON.stringify({
			data: {
				status: 'available',
				changePercent: 10,
				sample: {
					matchedListings: 5,
					matchedSuppliers: 3,
					matchedCoverage: 0.5
				}
			}
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
}

describe('MatchedPriceComparison', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-03T12:00:00.000Z').getTime());
	});
	afterEach(() => vi.unstubAllGlobals());

	it('reads an available comparison from the upstream data envelope', async () => {
		const fetchMock = vi.fn().mockResolvedValue(availableResponse());
		vi.stubGlobal('fetch', fetchMock);

		render(MatchedPriceComparison, { origins: ['Ethiopia'], viewMode: 'retail' });
		await fireEvent.click(screen.getByText('Choose dates and origin'));
		await fireEvent.change(screen.getByLabelText('Origin'), {
			target: { value: 'Ethiopia' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Compare prices' }));

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'Ethiopia retail, 2025-12-04 to 2026-01-02: +10.00% across 5 coffees from 3 suppliers (50% matched coverage).'
			)
		);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('wholesale=false'),
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it('explains missing observations without presenting a zero price change', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						data: { status: 'insufficient_fresh_coverage', changePercent: null }
					}),
					{ status: 200 }
				)
			)
		);
		render(MatchedPriceComparison, { origins: ['Ethiopia'], viewMode: 'retail' });
		expect(screen.getByRole('heading', { name: 'Price changes' })).toBeInTheDocument();
		await fireEvent.click(screen.getByText('Choose dates and origin'));
		await fireEvent.change(screen.getByLabelText('Origin'), { target: { value: 'Ethiopia' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Compare prices' }));
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'We’re collecting fresh price observations.'
			)
		);
		expect(screen.getByRole('status')).not.toHaveTextContent('0.00%');
	});

	it('clears old evidence and ignores a late response after the market scope changes', async () => {
		const pending = deferred<Response>();
		const fetchMock = vi.fn().mockReturnValue(pending.promise);
		vi.stubGlobal('fetch', fetchMock);

		const view = render(MatchedPriceComparison, { origins: ['Ethiopia'], viewMode: 'retail' });
		await fireEvent.click(screen.getByText('Choose dates and origin'));
		await fireEvent.change(screen.getByLabelText('Origin'), {
			target: { value: 'Ethiopia' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Compare prices' }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

		const request = fetchMock.mock.calls[0][1] as RequestInit;
		await view.rerender({ origins: ['Ethiopia'], viewMode: 'wholesale' });

		expect(request.signal).toBeInstanceOf(AbortSignal);
		expect(request.signal?.aborted).toBe(true);
		expect(screen.getByRole('status')).toHaveTextContent('');

		pending.resolve(availableResponse());
		await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''));
	});
});
