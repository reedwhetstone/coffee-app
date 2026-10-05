import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	anonymousPrincipal,
	apiKeyPrincipal,
	cookieSessionPrincipal
} from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentInventoryChoices: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient
}));
vi.mock('$lib/server/parchmentInventory', () => ({
	fetchParchmentInventoryChoices: mocks.fetchParchmentInventoryChoices
}));

import { GET } from './+server';

function makeEvent(principal: ReturnType<typeof cookieSessionPrincipal>) {
	const request = new Request('https://app.test/api/roast-coffees');
	return { request, url: new URL(request.url), locals: { principal } };
}

const choices = [
	{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush', purchase_date: '2026-07-28', stocked: true }
];

describe('/api/roast-coffees', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({ kind: 'session-client' });
		mocks.fetchParchmentInventoryChoices.mockResolvedValue(choices);
	});

	it('returns the member’s portfolio coffees from the session Parchment client', async () => {
		const event = makeEvent(cookieSessionPrincipal('member'));

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: choices });
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			signal: event.request.signal
		});
		expect(mocks.fetchParchmentInventoryChoices).toHaveBeenCalledWith({ kind: 'session-client' });
	});

	it.each([
		['a signed-out visitor', anonymousPrincipal(), 401],
		['an API key', apiKeyPrincipal(), 401],
		['an account without Mallard Studio', cookieSessionPrincipal('viewer'), 403]
	])('turns away %s before anything is read', async (_name, principal, status) => {
		const response = await GET(makeEvent(principal as never) as never);

		expect(response.status).toBe(status);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(mocks.fetchParchmentInventoryChoices).not.toHaveBeenCalled();
	});

	it('reports a failed read without the coffees', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.fetchParchmentInventoryChoices.mockRejectedValue(new Error('inventory unavailable'));

		const response = await GET(makeEvent(cookieSessionPrincipal('member')) as never);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Unable to load coffees' });
	});
});
