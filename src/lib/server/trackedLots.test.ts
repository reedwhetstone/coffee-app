import { describe, expect, it, vi } from 'vitest';
import {
	ParchmentTrackedLotError,
	getTrackedLotIds,
	getTrackedLotSummaries,
	trackTrackedLot,
	untrackTrackedLot
} from './trackedLots';
import type { ParchmentClient } from '@purveyors/sdk';

function makeClient(input: {
	list?: ReturnType<typeof vi.fn>;
	track?: ReturnType<typeof vi.fn>;
	untrack?: ReturnType<typeof vi.fn>;
}): ParchmentClient {
	return {
		portfolio: {
			trackedLots: {
				list: input.list ?? vi.fn(),
				track: input.track ?? vi.fn(),
				untrack: input.untrack ?? vi.fn()
			}
		}
	} as unknown as ParchmentClient;
}

describe('tracked-lot Parchment adapters', () => {
	it('returns the complete catalog-id set without requesting summaries', async () => {
		const list = vi.fn().mockResolvedValue({
			data: { data: { catalogIds: [10, 42, 7], summaries: [] } }
		});

		await expect(getTrackedLotIds(makeClient({ list }))).resolves.toEqual([10, 42, 7]);
		expect(list).toHaveBeenCalledWith({ summaryLimit: 0 });
	});

	it('returns bounded summaries and normalizes omitted unstockedDate to null', async () => {
		const list = vi.fn().mockResolvedValue({
			data: {
				data: {
					catalogIds: [1],
					summaries: [
						{
							catalogId: 1,
							trackedAt: '2026-06-01T00:00:00Z',
							priceAtTracking: 6.5,
							name: 'Ethiopia Guji',
							source: 'Supplier A',
							country: 'Ethiopia',
							region: 'Guji',
							processing: 'Natural',
							stocked: true,
							wholesale: false,
							currentPrice: 7.25,
							priceDelta: 0.75
						}
					]
				}
			}
		});

		await expect(getTrackedLotSummaries(makeClient({ list }), 25)).resolves.toEqual([
			expect.objectContaining({ catalogId: 1, unstockedDate: null, priceDelta: 0.75 })
		]);
		expect(list).toHaveBeenCalledWith({ summaryLimit: 25 });
	});

	it('surfaces typed upstream HTTP failures', async () => {
		const list = vi.fn().mockResolvedValue({
			error: { error: { code: 'forbidden', message: 'Portfolio access required' } },
			response: new Response(null, { status: 403 })
		});

		const promise = getTrackedLotIds(makeClient({ list }));
		await expect(promise).rejects.toMatchObject({
			name: 'ParchmentTrackedLotError',
			status: 403,
			message: 'Portfolio access required'
		});
		await expect(promise).rejects.toBeInstanceOf(ParchmentTrackedLotError);
	});

	it('rejects malformed success bodies instead of degrading them to a false empty list', async () => {
		const list = vi.fn().mockResolvedValue({ data: { data: { catalogIds: [] } } });
		await expect(getTrackedLotIds(makeClient({ list }))).rejects.toThrow(
			'invalid tracked-lot list response'
		);
	});

	it('sets tracked state explicitly and returns the normalized mutation', async () => {
		const track = vi.fn().mockResolvedValue({
			data: {
				data: {
					catalogId: 99,
					tracked: true,
					trackedAt: '2026-07-26T12:00:00Z',
					priceAtTracking: 6.8
				}
			}
		});

		await expect(trackTrackedLot(makeClient({ track }), 99)).resolves.toEqual({
			catalogId: 99,
			tracked: true,
			trackedAt: '2026-07-26T12:00:00Z',
			priceAtTracking: 6.8
		});
		expect(track).toHaveBeenCalledWith(99);
	});

	it('sets untracked state explicitly and rejects malformed success bodies', async () => {
		const untrack = vi
			.fn()
			.mockResolvedValueOnce({
				data: {
					data: {
						catalogId: 99,
						tracked: false,
						trackedAt: null,
						priceAtTracking: null
					}
				}
			})
			.mockResolvedValueOnce({ data: { data: { tracked: false } } });
		const client = makeClient({ untrack });

		await expect(untrackTrackedLot(client, 99)).resolves.toMatchObject({
			catalogId: 99,
			tracked: false
		});
		await expect(untrackTrackedLot(client, 99)).rejects.toThrow(
			'invalid tracked-lot mutation response'
		);
	});
});
