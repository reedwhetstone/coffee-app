import { describe, expect, it, vi } from 'vitest';
import {
	batchesToRemove,
	createdBatchId,
	deleteRoastsById,
	removeEmptyBatches,
	roastIdsForInventory,
	storageStateEmail,
	type CleanupRequest,
	type CleanupResponse
} from '../../../tests/e2e/batch-cleanup';

const EMPTY_NOW = 'aaaaaaaa-0000-4000-8000-000000000001';
const EMPTY_EARLIER = 'aaaaaaaa-0000-4000-8000-000000000002';
const HOLDS_ROASTS = 'aaaaaaaa-0000-4000-8000-000000000003';
const STARTED_AT = '2026-10-05T15:00:00.000Z';

function batch(id: string, roastCount: number, createdAt: string) {
	return {
		id,
		// An empty batch is listed under a placeholder, so it cannot be recognised by its name.
		name: roastCount === 0 ? 'Roast batch - 2026-10-05' : 'API_TEST_ROAST_1',
		batch_date: '2026-10-05',
		roast_count: roastCount,
		roast_ids: roastCount === 0 ? [] : [4531],
		coffee_ids: roastCount === 0 ? [] : [101],
		created_at: createdAt,
		updated_at: createdAt
	};
}

const listed = {
	data: [
		batch(EMPTY_NOW, 0, '2026-10-05T15:02:00.000Z'),
		batch(HOLDS_ROASTS, 1, '2026-10-05T15:03:00.000Z'),
		batch(EMPTY_EARLIER, 0, '2026-10-04T09:00:00.000Z')
	]
};

function response(status: number, body: unknown = {}): CleanupResponse {
	return { ok: () => status < 400, status: () => status, json: async () => body };
}

function requestStub(list: CleanupResponse, remove: (url: string) => CleanupResponse) {
	const request = {
		get: vi.fn(async () => list),
		delete: vi.fn(async (url: string) => remove(url))
	};
	return request satisfies CleanupRequest;
}

describe('choosing the batches a run may remove', () => {
	it('removes only empty batches created since the run started', () => {
		expect(batchesToRemove(listed, { scope: 'this-run', startedAt: STARTED_AT })).toEqual({
			empty: 2,
			ids: [EMPTY_NOW]
		});
	});

	it('allows for the runner and the API clocks differing by a few minutes', () => {
		const justBefore = { data: [batch(EMPTY_NOW, 0, '2026-10-05T14:57:00.000Z')] };
		const wellBefore = { data: [batch(EMPTY_NOW, 0, '2026-10-05T14:50:00.000Z')] };

		expect(batchesToRemove(justBefore, { scope: 'this-run', startedAt: STARTED_AT }).ids).toEqual([
			EMPTY_NOW
		]);
		expect(batchesToRemove(wellBefore, { scope: 'this-run', startedAt: STARTED_AT }).ids).toEqual(
			[]
		);
	});

	it('removes every empty batch only when told to', () => {
		expect(batchesToRemove(listed, { scope: 'all' })).toEqual({
			empty: 2,
			ids: [EMPTY_NOW, EMPTY_EARLIER]
		});
	});

	it('never selects a batch that holds a roast', () => {
		for (const scope of ['this-run', 'all'] as const) {
			expect(batchesToRemove(listed, { scope, startedAt: STARTED_AT }).ids).not.toContain(
				HOLDS_ROASTS
			);
		}
	});

	it('removes nothing when the start of the run is not known', () => {
		expect(batchesToRemove(listed, { scope: 'this-run' }).ids).toEqual([]);
		expect(batchesToRemove(listed, { scope: 'this-run', startedAt: 'not a date' }).ids).toEqual([]);
	});

	it('skips a row it cannot be sure about', () => {
		const body = {
			data: [
				{ id: EMPTY_NOW, created_at: '2026-10-05T15:02:00.000Z' }, // no roast count
				{ id: 'Wednesday roast', roast_count: 0, created_at: '2026-10-05T15:02:00.000Z' },
				{ id: EMPTY_EARLIER, roast_count: 0, created_at: 'unknown' },
				null
			]
		};

		expect(batchesToRemove(body, { scope: 'this-run', startedAt: STARTED_AT })).toEqual({
			empty: 1,
			ids: []
		});
		expect(batchesToRemove(body, { scope: 'all' }).ids).toEqual([EMPTY_EARLIER]);
		expect(batchesToRemove({ error: 'Unauthorized' }, { scope: 'all' })).toEqual({
			empty: 0,
			ids: []
		});
	});
});

describe('removing empty batches through the app', () => {
	it('lists empty batches too, and deletes each selected batch by its ID', async () => {
		const request = requestStub(response(200, listed), () => response(200, { success: true }));
		const log = vi.fn();

		const result = await removeEmptyBatches(request, {
			scope: 'this-run',
			startedAt: STARTED_AT,
			log
		});

		expect(request.get).toHaveBeenCalledWith('/api/roast-batches?include_empty=true');
		expect(request.delete.mock.calls).toEqual([[`/api/roast-batches/${EMPTY_NOW}`]]);
		expect(result).toEqual({ empty: 2, selected: 1, deleted: 1, failed: 0 });
		expect(log).toHaveBeenCalledWith(
			'[teardown] Roast batches: 2 empty, 1 deleted, 1 from earlier runs left in place'
		);
	});

	it('removes the earlier leftovers as well under the "all" scope', async () => {
		const request = requestStub(response(200, listed), () => response(200, { success: true }));

		const result = await removeEmptyBatches(request, { scope: 'all' });

		expect(request.delete.mock.calls.map(([url]) => url)).toEqual([
			`/api/roast-batches/${EMPTY_NOW}`,
			`/api/roast-batches/${EMPTY_EARLIER}`
		]);
		expect(result).toEqual({ empty: 2, selected: 2, deleted: 2, failed: 0 });
	});

	it('deletes nothing when the list cannot be read', async () => {
		const request = requestStub(response(403, { error: 'Member role required' }), () =>
			response(200)
		);
		const log = vi.fn();

		const result = await removeEmptyBatches(request, { scope: 'all', log });

		expect(request.delete).not.toHaveBeenCalled();
		expect(result).toEqual({ empty: 0, selected: 0, deleted: 0, failed: 0 });
		expect(log).toHaveBeenCalledWith('[teardown] Could not list roast batches (403); none removed');
	});

	it('counts a batch that is already gone as removed, and carries on past a failure', async () => {
		const request = requestStub(response(200, listed), (url) =>
			url.endsWith(EMPTY_NOW) ? response(404) : response(503)
		);
		const log = vi.fn();

		const result = await removeEmptyBatches(request, { scope: 'all', log });

		expect(result).toEqual({ empty: 2, selected: 2, deleted: 1, failed: 1 });
		expect(log).toHaveBeenCalledWith(
			`[teardown] Could not delete roast batch ${EMPTY_EARLIER} (503)`
		);
	});
});

describe('test-account roast cleanup through the app', () => {
	it('takes only roasts belonging to the account inventory and rejects an uncertain response', () => {
		expect(
			roastIdsForInventory(
				{
					data: [
						{ roast_id: 4531, coffee_id: 101 },
						{ roast_id: 4532, coffee_id: 202 }
					]
				},
				[101]
			)
		).toEqual([4531]);
		expect(
			roastIdsForInventory({ data: [{ roast_id: '4531', coffee_id: 101 }] }, [101])
		).toBeNull();
		expect(roastIdsForInventory({}, [101])).toBeNull();
	});

	it('deletes roast IDs through the route and reports failures for retry', async () => {
		const request = requestStub(response(200), (url) =>
			url.endsWith('4531') ? response(200) : response(503)
		);
		const log = vi.fn();
		expect(await deleteRoastsById(request, [4531, 4532], log)).toEqual({
			deleted: 1,
			failed: 1
		});
		expect(request.delete).toHaveBeenCalledWith('/api/roast-profiles?id=4531');
		expect(request.delete).toHaveBeenCalledWith('/api/roast-profiles?id=4532');
		expect(log).toHaveBeenCalledWith('[teardown] Could not delete roast 4532 (503)');
	});
});

describe('the batch a created roast belongs to', () => {
	it('reads the batch ID from the created roast', () => {
		expect(createdBatchId({ roast_id: 4531, batch_id: EMPTY_NOW })).toBe(EMPTY_NOW);
	});

	it.each([null, undefined, {}, { batch_id: 'API_TEST_ROAST_1' }, { batch_id: 4531 }])(
		'reads no batch from %j',
		(profile) => {
			expect(createdBatchId(profile)).toBeNull();
		}
	);
});

describe('the account a saved session is signed in as', () => {
	const SUPABASE = 'https://projectref.supabase.co';
	const session = JSON.stringify({
		access_token: 'token',
		user: { id: 'user-1', email: 'E2E.Tester@example.com' }
	});

	it('reads the email from the Supabase auth cookie', () => {
		const state = {
			cookies: [
				{ name: 'other', value: 'x' },
				{ name: 'sb-projectref-auth-token', value: session }
			]
		};

		expect(storageStateEmail(state, SUPABASE)).toBe('e2e.tester@example.com');
	});

	it('joins a session stored in chunks, in order', () => {
		const state = {
			cookies: [
				{ name: 'sb-projectref-auth-token.1', value: session.slice(20) },
				{ name: 'sb-projectref-auth-token.0', value: session.slice(0, 20) }
			]
		};

		expect(storageStateEmail(state, SUPABASE)).toBe('e2e.tester@example.com');
	});

	it('reads a session stored base64-encoded', () => {
		const state = {
			cookies: [
				{
					name: 'sb-projectref-auth-token',
					value: `base64-${Buffer.from(session).toString('base64url')}`
				}
			]
		};

		expect(storageStateEmail(state, SUPABASE)).toBe('e2e.tester@example.com');
	});

	it.each([
		['no cookies', {}],
		['another project’s cookie', { cookies: [{ name: 'sb-other-auth-token', value: session }] }],
		[
			'a cookie that is not a session',
			{ cookies: [{ name: 'sb-projectref-auth-token', value: 'x' }] }
		],
		[
			'a session with no email',
			{ cookies: [{ name: 'sb-projectref-auth-token', value: JSON.stringify({ user: {} }) }] }
		]
	])('reads no account from %s', (_case, state) => {
		expect(storageStateEmail(state, SUPABASE)).toBeNull();
	});

	it('reads no account when the Supabase address is not one', () => {
		expect(storageStateEmail({ cookies: [] }, 'not a url')).toBeNull();
	});
});
