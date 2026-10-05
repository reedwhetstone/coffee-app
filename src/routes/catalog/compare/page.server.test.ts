import { beforeEach, describe, expect, it, vi } from 'vitest';

const compare = vi.fn();
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: vi.fn(async () => ({ catalog: { compare } }))
}));

import { load } from './+page.server';

function event(query: string, isAuthenticated = true) {
	return {
		url: new URL(`https://purveyors.io/catalog/compare?${query}`),
		locals: { principal: { isAuthenticated } }
	} as unknown as Parameters<typeof load>[0];
}

describe('/catalog/compare load', () => {
	beforeEach(() => compare.mockReset());

	it('asks for two coffees before calling Parchment', async () => {
		const result = (await load(event('ids=416'))) as { state: { status: string } };
		expect(result.state.status).toBe('empty');
		expect(compare).not.toHaveBeenCalled();
	});

	it('asks signed-out visitors to sign in', async () => {
		const result = (await load(event('ids=416,8806', false))) as { state: { status: string } };
		expect(result.state.status).toBe('sign_in');
		expect(compare).not.toHaveBeenCalled();
	});

	it('returns the comparison and forwards ids and quantity', async () => {
		compare.mockResolvedValue({
			data: {
				data: { lots: [{ id: 416 }, { id: 8806 }], rows: [], missingIds: [] },
				meta: { maxLots: 6 }
			},
			response: new Response(null, { status: 200 })
		});
		const result = (await load(event('ids=416,8806&quantityLbs=5'))) as {
			state: { status: string; maxLots?: number };
		};
		expect(result.state).toMatchObject({ status: 'ready', maxLots: 6 });
		expect(compare).toHaveBeenCalledWith({ ids: '416,8806', quantityLbs: '5' });
	});

	it('falls back to the pick-two state when fewer than two coffees come back', async () => {
		compare.mockResolvedValue({
			data: { data: { lots: [{ id: 416 }], rows: [], missingIds: [8806] }, meta: { maxLots: 6 } },
			response: new Response(null, { status: 200 })
		});
		expect(((await load(event('ids=416,8806'))) as { state: unknown }).state).toEqual({
			status: 'empty',
			unavailable: 1
		});
	});

	it('maps Parchment limit and error responses', async () => {
		compare.mockResolvedValue({
			error: { error: { message: 'Viewers can compare 2 coffees; members compare up to 6' } },
			response: new Response(null, { status: 403 })
		});
		expect(((await load(event('ids=1,2,3'))) as { state: unknown }).state).toEqual({
			status: 'limit',
			message: 'Viewers can compare 2 coffees; members compare up to 6'
		});
		compare.mockResolvedValue({ error: {}, response: new Response(null, { status: 500 }) });
		expect(((await load(event('ids=1,2'))) as { state: { status: string } }).state.status).toBe(
			'error'
		);
	});
});
