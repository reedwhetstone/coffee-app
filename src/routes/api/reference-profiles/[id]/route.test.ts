import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));
vi.mock('$lib/server/parchmentClient', () => parchmentMocks);

import { DELETE, PATCH } from './+server';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';

function event(
	method: 'PATCH' | 'DELETE',
	id: string,
	body?: unknown,
	role: 'viewer' | 'member' | null = 'member'
) {
	const request = new Request(`https://app.test/api/reference-profiles/${id}`, {
		method,
		headers: { Origin: 'https://app.test', 'Content-Type': 'application/json' },
		...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
	});
	return {
		request,
		params: { id },
		url: new URL(request.url),
		fetch: vi.fn(),
		locals: { principal: role ? cookieSessionPrincipal(role) : { isAuthenticated: false } }
	};
}

describe('PATCH /api/reference-profiles/[id]', () => {
	beforeEach(() => vi.clearAllMocks());

	it('renames the reference with the trimmed name and nothing else', async () => {
		const update = vi.fn().mockResolvedValue({
			data: { data: { id: KEEPER, title: 'Guji keeper, washed' } },
			response: { status: 200 }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ referenceProfiles: { update } });

		const response = await PATCH(
			event('PATCH', KEEPER, {
				title: '  Guji keeper, washed  ',
				status: 'archived',
				notes: 'x'
			}) as never
		);

		expect(response.status).toBe(200);
		expect(update).toHaveBeenCalledWith(KEEPER, { title: 'Guji keeper, washed' });
		expect(await response.json()).toEqual({ data: { id: KEEPER, title: 'Guji keeper, washed' } });
	});

	it.each([{ title: '   ' }, { title: 42 }, {}, null])(
		'asks for a name when sent %j',
		async (body) => {
			const update = vi.fn();
			parchmentMocks.createParchmentServerClient.mockResolvedValue({
				referenceProfiles: { update }
			});

			const response = await PATCH(event('PATCH', KEEPER, body) as never);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Enter a name' });
			expect(update).not.toHaveBeenCalled();
		}
	);

	it('answers a body that is not JSON with 400', async () => {
		const response = await PATCH(event('PATCH', KEEPER, '{not json') as never);

		expect(response.status).toBe(400);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('passes on Parchment’s refusal', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: {
				update: vi.fn().mockResolvedValue({
					error: { error: { code: 'not_found', message: 'Reference profile not found' } },
					response: { status: 404 }
				})
			}
		});

		const response = await PATCH(event('PATCH', KEEPER, { title: 'New name' }) as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Reference profile not found' });
	});

	it.each([
		['viewer', 403],
		[null, 401]
	] as const)('refuses a %s before Parchment is asked', async (role, status) => {
		const response = await PATCH(event('PATCH', KEEPER, { title: 'New name' }, role) as never);

		expect(response.status).toBe(status);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('says saved references are unavailable, by their own name, when Parchment is not set up', async () => {
		parchmentMocks.createParchmentServerClient.mockRejectedValue(
			new parchmentMocks.ParchmentConfigError('missing base URL')
		);

		const response = await PATCH(event('PATCH', KEEPER, { title: 'New name' }) as never);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Saved references and plans are temporarily unavailable'
		});
	});

	it('rejects an ID that is not a saved reference', async () => {
		const response = await PATCH(event('PATCH', '4531', { title: 'New name' }) as never);

		expect(response.status).toBe(400);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});

describe('DELETE /api/reference-profiles/[id]', () => {
	beforeEach(() => vi.clearAllMocks());

	it('removes the reference and answers with no content', async () => {
		const remove = vi.fn().mockResolvedValue({ response: { status: 204 } });
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: { delete: remove }
		});

		const response = await DELETE(event('DELETE', KEEPER) as never);

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
		expect(remove).toHaveBeenCalledWith(KEEPER);
	});

	it('passes on Parchment’s refusal and removes nothing', async () => {
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			referenceProfiles: {
				delete: vi.fn().mockResolvedValue({
					error: { error: { code: 'conflict', message: 'A plan is built on this reference' } },
					response: { status: 409 }
				})
			}
		});

		const response = await DELETE(event('DELETE', KEEPER) as never);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'A plan is built on this reference' });
	});

	it.each([
		['viewer', 403],
		[null, 401]
	] as const)('refuses a %s before Parchment is asked', async (role, status) => {
		const response = await DELETE(event('DELETE', KEEPER, undefined, role) as never);

		expect(response.status).toBe(status);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('rejects an ID that is not a saved reference', async () => {
		const response = await DELETE(event('DELETE', 'everything') as never);

		expect(response.status).toBe(400);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});
