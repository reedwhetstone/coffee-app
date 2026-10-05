import { describe, expect, it, vi } from 'vitest';
import {
	mergeRoasts,
	requestBatchRoasts,
	requestRoast,
	requestRoasts,
	RoastListRequestError
} from './roast-list-loader';

const totals = { roasts: 2, batches: 1, average_loss_percent: 14.5 };
const fetcher = (response: Response) =>
	vi.fn(async (input: RequestInfo | URL) => {
		void input;
		return response;
	});

describe('requestRoasts', () => {
	it('asks the roast list route and returns the roasts with their totals', async () => {
		const fetch = fetcher(Response.json({ data: [{ roast_id: 4531 }], totals }));

		await expect(
			requestRoasts(new URLSearchParams({ q: 'guji drop', limit: '50' }), fetch)
		).resolves.toEqual({ data: [{ roast_id: 4531 }], totals });
		expect(fetch).toHaveBeenCalledWith('/api/roast-profiles?q=guji+drop&limit=50');
	});

	it('accepts totals with no average loss', async () => {
		const none = { roasts: 0, batches: 0, average_loss_percent: null };

		await expect(
			requestRoasts('limit=50', fetcher(Response.json({ data: [], totals: none })))
		).resolves.toEqual({ data: [], totals: none });
	});

	it('tells a search that cannot be used apart from a failure', async () => {
		const invalid = await requestRoasts(
			'q=x',
			fetcher(Response.json({ error: 'Invalid search term', code: 'invalid_search' }, { status: 400 }))
		).catch((error: unknown) => error);

		expect(invalid).toBeInstanceOf(RoastListRequestError);
		expect(invalid).toMatchObject({ kind: 'invalid-search' });
	});

	it.each([
		['another 400', Response.json({ error: 'Invalid date' }, { status: 400 })],
		['a server failure', Response.json({ error: 'Failed' }, { status: 500 })],
		['a failure with no body', new Response(null, { status: 502 })],
		['a signed-out session', Response.json({ error: 'Unauthorized' }, { status: 401 })],
		['an answer with no totals', Response.json({ data: [] })],
		['an answer with no roasts', Response.json({ totals })]
	])('reports %s as a failure to try again', async (_name, response) => {
		await expect(requestRoasts('limit=50', fetcher(response))).rejects.toMatchObject({
			kind: 'failed'
		});
	});
});

describe('requests for one roast and one batch', () => {
	it('reads one roast by its number', async () => {
		const fetch = fetcher(Response.json({ data: [{ roast_id: 4531 }], totals }));

		await expect(requestRoast(4531, fetch)).resolves.toEqual({ roast_id: 4531 });
		expect(fetch).toHaveBeenCalledWith('/api/roast-profiles?roast_id=4531');
	});

	it('returns null for a roast the account does not have', async () => {
		const none = { roasts: 0, batches: 0, average_loss_percent: null };

		await expect(
			requestRoast(9, fetcher(Response.json({ data: [], totals: none })))
		).resolves.toBeNull();
	});

	it('reads every roast of one batch', async () => {
		const batch = 'aaaaaaaa-0000-4000-8000-000000000001';
		const fetch = fetcher(Response.json({ data: [{ roast_id: 2 }, { roast_id: 1 }], totals }));

		await expect(requestBatchRoasts(batch, fetch)).resolves.toEqual([
			{ roast_id: 2 },
			{ roast_id: 1 }
		]);
		expect(fetch).toHaveBeenCalledWith(`/api/roast-profiles?batch_id=${batch}`);
	});
});

describe('mergeRoasts', () => {
	it('adds the roasts not already held, in order, and keeps the copy already held', () => {
		const held = [
			{ roast_id: 3, note: 'held' },
			{ roast_id: 2, note: 'held' }
		];

		expect(
			mergeRoasts(held, [
				{ roast_id: 2, note: 'added' },
				{ roast_id: 1, note: 'added' },
				{ roast_id: 1, note: 'again' }
			])
		).toEqual([
			{ roast_id: 3, note: 'held' },
			{ roast_id: 2, note: 'held' },
			{ roast_id: 1, note: 'added' }
		]);
		expect(held).toHaveLength(2);
	});
});
