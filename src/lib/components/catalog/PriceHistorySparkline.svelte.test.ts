import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import PriceHistorySparkline from './PriceHistorySparkline.svelte';

const point = (date: string, priceLb: number, minLbs = 1) => ({
	date,
	priceLb,
	minLbs,
	tiers: [{ minLbs, priceLb }],
	stocked: true,
	wholesale: false
});

const respond = (data: unknown, status = 200) =>
	vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { status }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('PriceHistorySparkline', () => {
	it('marks a tier-ladder change and does not claim a comparable price move', async () => {
		const fetchMock = respond({
			points: [
				point('2026-09-21', 43.36, 0.5),
				point('2026-09-22', 43.36, 0.5),
				point('2026-09-23', 19.99)
			],
			events: [
				{
					date: '2026-09-23',
					type: 'tier_ladder_change',
					fromMinLbs: [0.5, 1, 5, 50],
					toMinLbs: [1, 5, 50]
				}
			],
			summary: {
				latestPriceLb: 19.99,
				minPriceLb: 19.99,
				maxPriceLb: 43.36,
				comparableChangePct: null,
				tierLadderChanged: true
			}
		});
		vi.stubGlobal('fetch', fetchMock);
		render(PriceHistorySparkline, { coffeeId: 8806 });
		await screen.findByText(/tier structure changed/i);
		expect(
			screen.getByText('Sep 23: tiers changed, minimum order 0.5 lb → 1 lb.')
		).toBeInTheDocument();
		expect(screen.queryByText(/Down \d/)).toBeNull();
		expect(screen.getByRole('img')).toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/catalog/8806/price-history?days=180',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it('states a same-tier change and range', async () => {
		vi.stubGlobal(
			'fetch',
			respond({
				points: [point('2026-07-01', 10), point('2026-08-01', 9.5), point('2026-09-01', 9)],
				events: [],
				summary: {
					latestPriceLb: 9,
					minPriceLb: 9,
					maxPriceLb: 10,
					comparableChangePct: -10,
					tierLadderChanged: false
				}
			})
		);
		render(PriceHistorySparkline, { coffeeId: 1 });
		await screen.findByText('Down 10.0% since Jul 1, same tiers.');
		expect(screen.getByText('Range $9.00–$10.00/lb')).toBeInTheDocument();
	});

	it('handles thin history and upstream errors without a chart', async () => {
		vi.stubGlobal(
			'fetch',
			respond({
				points: [point('2026-09-01', 9)],
				events: [],
				summary: {
					latestPriceLb: 9,
					minPriceLb: 9,
					maxPriceLb: 9,
					comparableChangePct: null,
					tierLadderChanged: false
				}
			})
		);
		render(PriceHistorySparkline, { coffeeId: 1 });
		await screen.findByText(/seen on two different days/);
		expect(screen.queryByRole('img')).toBeNull();
		cleanup();

		vi.stubGlobal('fetch', respond({ error: 'forbidden' }, 403));
		render(PriceHistorySparkline, { coffeeId: 1 });
		await screen.findByText('Price history is unavailable right now.');
	});
});
