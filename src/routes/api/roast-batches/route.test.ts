import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));
vi.mock('$lib/server/parchmentClient', () => parchmentMocks);

import { GET } from './+server';
import { DELETE } from './[id]/+server';

const WEDNESDAY = 'aaaaaaaa-0000-4000-8000-000000000001';
const LEFTOVER = 'aaaaaaaa-0000-4000-8000-000000000002';

function batch(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: 'Wednesday roast',
		batch_date: '2026-10-01',
		roast_count: 2,
		roast_ids: [4531, 4530],
		coffee_ids: [101, 102],
		created_at: '2026-10-01T15:00:00Z',
		updated_at: '2026-10-01T15:00:00Z',
		...overrides
	};
}

function event(
	method: 'GET' | 'DELETE',
	path: string,
	options: { role?: 'viewer' | 'member' | 'admin' | null; id?: string; origin?: string } = {}
) {
	const role = options.role === undefined ? 'member' : options.role;
	const url = new URL(`https://app.test${path}`);
	// A plain request stand-in: the test environment's Request drops the Origin header.
	const headers = new Map<string, string>(
		method === 'GET' ? [] : [['origin', options.origin ?? url.origin]]
	);
	const request = {
		method,
		url: url.href,
		headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
		signal: new AbortController().signal
	};
	return {
		request,
		params: { id: options.id },
		url,
		fetch: vi.fn(),
		locals: { principal: role ? cookieSessionPrincipal(role) : { isAuthenticated: false } }
	};
}

describe('GET /api/roast-batches', () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		['a signed-out visitor', null, 401],
		['an account without Mallard Studio', 'viewer' as const, 403]
	])('refuses %s before reaching Parchment', async (_who, role, status) => {
		const response = await GET(event('GET', '/api/roast-batches', { role }) as never);

		expect(response.status).toBe(status);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it("lists the member's batches that hold roasts, reading every page", async () => {
		const firstPage = Array.from({ length: 200 }, (_, index) =>
			batch(`bbbbbbbb-0000-4000-8000-${String(index).padStart(12, '0')}`)
		);
		const list = vi
			.fn()
			.mockResolvedValueOnce({ data: { data: firstPage } })
			.mockResolvedValueOnce({ data: { data: [batch(WEDNESDAY)] } });
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roastBatches: { list } });

		const response = await GET(event('GET', '/api/roast-batches') as never);

		expect(response.status).toBe(200);
		expect((await response.json()).data).toHaveLength(201);
		expect(list).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { limit: 200, offset: 200 });
	});

	it('lists batches with no roasts only when asked', async () => {
		const list = vi.fn().mockResolvedValue({
			data: { data: [batch(LEFTOVER, { roast_count: 0, roast_ids: [], coffee_ids: [] })] }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roastBatches: { list } });

		const response = await GET(event('GET', '/api/roast-batches?include_empty=true') as never);

		expect(response.status).toBe(200);
		expect(list).toHaveBeenCalledWith({ include_empty: 'true', limit: 200, offset: 0 });
		expect((await response.json()).data[0].id).toBe(LEFTOVER);
	});

	it('refuses an include_empty value it does not know', async () => {
		const response = await GET(event('GET', '/api/roast-batches?include_empty=yes') as never);

		expect(response.status).toBe(400);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('answers 503 when Parchment is not configured', async () => {
		parchmentMocks.createParchmentServerClient.mockRejectedValue(
			new parchmentMocks.ParchmentConfigError('missing')
		);

		const response = await GET(event('GET', '/api/roast-batches') as never);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Roast batches are temporarily unavailable' });
	});
});

describe('DELETE /api/roast-batches/[id]', () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		['a signed-out visitor', null, 401],
		['an account without Mallard Studio', 'viewer' as const, 403]
	])('refuses %s before reaching Parchment', async (_who, role, status) => {
		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, { role, id: WEDNESDAY }) as never
		);

		expect(response.status).toBe(status);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('refuses a delete sent from another site', async () => {
		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, {
				id: WEDNESDAY,
				origin: 'https://elsewhere.test'
			}) as never
		);

		expect(response.status).toBe(403);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each(['Wednesday roast', '4531', ''])('refuses %j, which is not a batch ID', async (id) => {
		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${encodeURIComponent(id) || 'x'}`, { id }) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid roast batch' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('deletes that one batch by ID and reports the roasts removed with it', async () => {
		const remove = vi.fn().mockResolvedValue({
			data: {
				data: { id: WEDNESDAY, batchName: 'Wednesday roast', ids: [4531, 4530], deleted: true }
			},
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roastBatches: { delete: remove }
		});

		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, { id: WEDNESDAY }) as never
		);

		expect(response.status).toBe(200);
		expect(remove).toHaveBeenCalledOnce();
		expect(remove).toHaveBeenCalledWith(WEDNESDAY);
		expect(await response.json()).toEqual({
			success: true,
			id: WEDNESDAY,
			roastIds: [4531, 4530]
		});
	});

	it('treats a batch ID sent in capitals as the same batch, and does not fail a delete that went through', async () => {
		const remove = vi.fn().mockResolvedValue({
			data: {
				data: { id: WEDNESDAY, batchName: 'Wednesday roast', ids: [4531, 4530], deleted: true }
			},
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roastBatches: { delete: remove }
		});
		const capitals = WEDNESDAY.toUpperCase();

		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${capitals}`, { id: capitals }) as never
		);

		expect(response.status).toBe(200);
		expect(remove).toHaveBeenCalledWith(WEDNESDAY);
		expect(await response.json()).toEqual({
			success: true,
			id: WEDNESDAY,
			roastIds: [4531, 4530]
		});
	});

	it('accepts an acknowledgement that names the batch in capitals', async () => {
		const remove = vi.fn().mockResolvedValue({
			data: {
				data: { id: WEDNESDAY.toUpperCase(), batchName: 'Wednesday roast', ids: [], deleted: true }
			},
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roastBatches: { delete: remove }
		});

		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, { id: WEDNESDAY }) as never
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, id: WEDNESDAY, roastIds: [] });
	});

	it("passes on Parchment's status and message when the batch is not there", async () => {
		const remove = vi.fn().mockResolvedValue({
			error: { error: { code: 'not_found', message: 'Roast batch not found' } },
			response: { status: 404 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roastBatches: { delete: remove }
		});

		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, { id: WEDNESDAY }) as never
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Roast batch not found' });
	});

	it('does not report success for an acknowledgement of another batch', async () => {
		const remove = vi.fn().mockResolvedValue({
			data: { data: { id: LEFTOVER, batchName: 'Wednesday roast', ids: [], deleted: true } },
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			roastBatches: { delete: remove }
		});

		const response = await DELETE(
			event('DELETE', `/api/roast-batches/${WEDNESDAY}`, { id: WEDNESDAY }) as never
		);

		expect(response.status).toBe(502);
	});
});
