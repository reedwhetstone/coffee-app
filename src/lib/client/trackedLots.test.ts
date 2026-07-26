import { describe, expect, it, vi } from 'vitest';
import { createTrackedLotStateController, setTrackedLotState } from './trackedLots';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function stateResponse(catalogId: number, tracked: boolean): Response {
	return new Response(
		JSON.stringify({
			catalogId,
			tracked,
			trackedAt: tracked ? '2026-07-26T12:00:00Z' : null,
			priceAtTracking: tracked ? 7.1 : null
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

describe('setTrackedLotState', () => {
	it.each([true, false])('sends the explicit desired state %s', async (tracked) => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					catalogId: 42,
					tracked,
					trackedAt: tracked ? '2026-07-26T12:00:00Z' : null,
					priceAtTracking: tracked ? 7.1 : null
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await expect(setTrackedLotState(fetcher, 42, tracked)).resolves.toMatchObject({
			catalogId: 42,
			tracked
		});
		expect(fetcher).toHaveBeenCalledWith('/api/catalog/42/track', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tracked })
		});
	});

	it('throws on a failed response so optimistic callers can roll back', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
		await expect(setTrackedLotState(fetcher, 42, true)).rejects.toThrow('status 503');
	});
});

describe('createTrackedLotStateController', () => {
	it('serializes rapid same-lot changes and eventually applies the latest intent', async () => {
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetcher = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const applied: Array<[number, boolean]> = [];
		const controller = createTrackedLotStateController(fetcher, (id, tracked) => {
			applied.push([id, tracked]);
		});

		const firstRun = controller.setDesiredState(42, false, true);
		const secondRun = controller.setDesiredState(42, true, false);

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(applied).toEqual([
			[42, true],
			[42, false]
		]);

		first.resolve(stateResponse(42, true));
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
		expect(fetcher.mock.calls[1][1]).toMatchObject({
			body: JSON.stringify({ tracked: false })
		});

		second.resolve(stateResponse(42, false));
		await Promise.all([firstRun, secondRun]);
		expect(applied.at(-1)).toEqual([42, false]);
	});

	it('ignores a stale failure and does not roll back newer intent', async () => {
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetcher = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const applied: Array<[number, boolean]> = [];
		const controller = createTrackedLotStateController(fetcher, (id, tracked) => {
			applied.push([id, tracked]);
		});

		const firstRun = controller.setDesiredState(42, false, true);
		const secondRun = controller.setDesiredState(42, true, false);
		first.resolve(new Response(null, { status: 503 }));

		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
		expect(applied).toHaveLength(2);

		second.resolve(stateResponse(42, false));
		await Promise.all([firstRun, secondRun]);
		expect(applied).toEqual([
			[42, true],
			[42, false],
			[42, false]
		]);
	});

	it('allows different lots to mutate concurrently', async () => {
		const lotOne = deferred<Response>();
		const lotTwo = deferred<Response>();
		const fetcher = vi
			.fn()
			.mockImplementationOnce(() => lotOne.promise)
			.mockImplementationOnce(() => lotTwo.promise);
		const controller = createTrackedLotStateController(fetcher, vi.fn());

		const one = controller.setDesiredState(1, false, true);
		const two = controller.setDesiredState(2, false, true);
		expect(fetcher).toHaveBeenCalledTimes(2);

		lotOne.resolve(stateResponse(1, true));
		lotTwo.resolve(stateResponse(2, true));
		await Promise.all([one, two]);
	});
});
