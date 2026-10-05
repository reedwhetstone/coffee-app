import { describe, expect, it, vi } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import { ROAST_PAGE_LIMIT } from '$lib/server/parchmentRoasts';
import {
	roastBatchesResponse,
	roastListResponse
} from '../../routes/roast/__test-fixtures__/roastListBackend';
import {
	completeBatches,
	mergeRoasts,
	requestBatchRosters,
	requestBatchRoasts,
	requestRoast,
	requestRoasts,
	ROAST_REQUEST_LIMIT,
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
			fetcher(
				Response.json({ error: 'Invalid search term', code: 'invalid_search' }, { status: 400 })
			)
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

const batchId = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const roast = (roast_id: number, batch: number, roast_date: string, coffee_id = 101) =>
	({
		roast_id,
		batch_id: batchId(batch),
		batch_name: 'Daily roast',
		roast_date,
		coffee_id,
		coffee_name: coffee_id === 101 ? 'Ethiopia Guji' : 'Colombia Sierra Nevada'
	}) as RoastProfile;

/**
 * The first page of five roasts under a filter, then its batches finished, against stand-ins
 * for the list route and the batch route over the same roasts.
 */
async function firstPageFinished(
	roasts: RoastProfile[],
	options: {
		filter?: string;
		whole?: string[];
		fail?: (url: string) => boolean;
	} = {}
) {
	const filter = options.filter ? `${options.filter}&` : '';
	const sent: string[] = [];
	const fetcher = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		sent.push(url);
		if (options.fail?.(url)) return Response.json({ error: 'Failed' }, { status: 500 });
		return url.startsWith('/api/roast-batches')
			? roastBatchesResponse(roasts, url)
			: roastListResponse(roasts, url);
	}) as unknown as typeof fetch;
	const page = await requestRoasts(`${filter}limit=5&offset=0`, fetcher);
	sent.length = 0;

	const finished = await completeBatches({
		held: page.data,
		page: page.data,
		offset: page.data.length,
		matching: page.totals.roasts,
		whole: new Set((options.whole ?? []).map(Number).map(batchId)),
		query: (batch, onePage) =>
			filter + (batch ? `batch_id=${batch}` : `limit=${onePage!.limit}&offset=${onePage!.offset}`),
		fetcher
	});
	return {
		sent,
		ids: finished.roasts.map((row) => row.roast_id),
		whole: [...finished.whole].sort()
	};
}

// Four batches of two, one batch a day, newest first: 42 41 | 32 31 | 22 21 | 12 11.
const daily = [4, 3, 2, 1].flatMap((n) => [
	roast(n * 10 + 2, n, `2026-10-0${n}`),
	roast(n * 10 + 1, n, `2026-10-0${n}`)
]);

describe('requestBatchRosters', () => {
	it('reads the batches dated in a span, each with the roasts it holds', async () => {
		const fetch = fetcher(roastBatchesResponse(daily, '/api/roast-batches'));

		const rosters = await requestBatchRosters('2026-10-02', '2026-10-04', fetch);

		expect(fetch).toHaveBeenCalledWith(
			'/api/roast-batches?date_start=2026-10-02&date_end=2026-10-04'
		);
		expect(rosters.get(batchId(3))).toEqual([32, 31]);
	});

	it('fails when the batches cannot be loaded or read', async () => {
		await expect(
			requestBatchRosters('2026-10-02', '2026-10-04', fetcher(new Response(null, { status: 500 })))
		).rejects.toThrow();
		await expect(
			requestBatchRosters('2026-10-02', '2026-10-04', fetcher(Response.json({ batches: [] })))
		).rejects.toThrow();
	});
});

describe('completeBatches', () => {
	it('asks for nothing when no roast is left to load', async () => {
		const { sent, ids, whole } = await firstPageFinished(daily.slice(0, 4));

		expect(sent).toEqual([]);
		expect(ids).toEqual([42, 41, 32, 31]);
		expect(whole).toEqual([batchId(3), batchId(4)]);
	});

	it('reads the batch the page ends in, and no other when the rest are whole', async () => {
		const { sent, ids, whole } = await firstPageFinished(daily);

		expect(ids).toEqual([42, 41, 32, 31, 22, 21]);
		expect(sent.sort()).toEqual([
			'/api/roast-batches?date_start=2026-10-02&date_end=2026-10-04',
			`/api/roast-profiles?batch_id=${batchId(2)}`
		]);
		expect(whole).toEqual([batchId(2), batchId(3), batchId(4)]);
	});

	it('finishes a batch with an older roast the page did not reach', async () => {
		// The newest batch also holds a roast from a month before, far past the page.
		const { sent, ids, whole } = await firstPageFinished([...daily, roast(5, 4, '2026-09-01')]);

		expect(ids).toEqual([42, 41, 32, 31, 22, 21, 5]);
		expect(sent).toContain(`/api/roast-profiles?batch_id=${batchId(4)}`);
		expect(whole).toEqual([batchId(2), batchId(3), batchId(4)]);
	});

	it('finishes a batch cut on the page’s last day that the page does not end in', async () => {
		// Two batches were roasted on October 2, turn about: 22 (batch 2), 21 (batch 5),
		// 20 (batch 2), 19 (batch 5). A page of five ends on 20, with batch 2 whole and 19 left.
		const turnAbout = [
			roast(42, 4, '2026-10-04'),
			roast(41, 4, '2026-10-04'),
			roast(22, 2, '2026-10-02'),
			roast(21, 5, '2026-10-02'),
			roast(20, 2, '2026-10-02'),
			roast(19, 5, '2026-10-02'),
			roast(12, 1, '2026-10-01'),
			roast(11, 1, '2026-10-01')
		];

		const { sent, ids, whole } = await firstPageFinished(turnAbout);

		expect(ids).toEqual([42, 41, 22, 21, 20, 19]);
		expect(sent).toContain(`/api/roast-profiles?batch_id=${batchId(5)}`);
		expect(whole).toEqual([batchId(2), batchId(4), batchId(5)]);
	});

	it('reads the roasts after the page once when that is fewer requests than a batch at a time', async () => {
		// Eight batches of an Ethiopia and a Colombia, and the list is narrowed to the Ethiopia.
		// Every batch holds a roast the list does not, so none can be told whole by its roasts.
		const mixed = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((n) => [
			roast(n * 10 + 2, n, `2026-10-0${n}`, 101),
			roast(n * 10 + 1, n, `2026-10-0${n}`, 102)
		]);
		// Batch 7 has one more Ethiopia, roasted a month before.
		const { sent, ids, whole } = await firstPageFinished([...mixed, roast(5, 7, '2026-09-01')], {
			filter: 'coffee_id=101'
		});

		// The older roast of batch 7 is added. The roasts of batches not yet shown are not.
		expect(ids).toEqual([82, 72, 62, 52, 42, 5]);
		expect(sent.filter((url) => url.includes('limit='))).toEqual([
			`/api/roast-profiles?coffee_id=101&limit=${ROAST_REQUEST_LIMIT}&offset=5`
		]);
		expect(sent.filter((url) => url.includes('batch_id='))).toEqual([
			`/api/roast-profiles?coffee_id=101&batch_id=${batchId(4)}`
		]);
		expect(whole).toEqual([4, 5, 6, 7, 8].map(batchId));
	});

	it('does not ask again for a batch already known whole', async () => {
		const { sent, ids } = await firstPageFinished(daily, { whole: ['2', '3', '4'] });

		expect(sent).toEqual([]);
		expect(ids).toEqual([42, 41, 32, 31, 22]);
	});

	it('finishes only the batch the page ends in when the batches cannot be listed', async () => {
		const { ids, whole } = await firstPageFinished([...daily, roast(5, 4, '2026-09-01')], {
			fail: (url) => url.startsWith('/api/roast-batches')
		});

		expect(ids).toEqual([42, 41, 32, 31, 22, 21]);
		// The others may be cut, so they are not marked whole.
		expect(whole).toEqual([batchId(2)]);
	});

	it('leaves a batch as it is, and not marked whole, when its roasts cannot be read', async () => {
		const { ids, whole } = await firstPageFinished([...daily, roast(5, 4, '2026-09-01')], {
			fail: (url) => url.endsWith(`batch_id=${batchId(4)}`)
		});

		expect(ids).toEqual([42, 41, 32, 31, 22, 21]);
		expect(whole).toEqual([batchId(2), batchId(3)]);
	});

	it('reads ahead no more roasts at a time than the list route returns', () => {
		expect(ROAST_REQUEST_LIMIT).toBeLessThanOrEqual(ROAST_PAGE_LIMIT);
	});
});
