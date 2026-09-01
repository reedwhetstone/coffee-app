import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		setMarketRead: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { DELETE, POST, PUT } from './+server';

const preference = {
	publication: 'market_read',
	status: 'subscribed',
	subscribed: true,
	consentSource: 'signup',
	consentedAt: '2026-08-31T01:00:00.000Z',
	unsubscribedAt: null,
	createdAt: '2026-08-31T01:00:00.000Z',
	updatedAt: '2026-08-31T01:00:00.000Z'
};

function makeEvent(method: 'POST' | 'PUT' | 'DELETE', origin = 'https://app.test') {
	const request = new Request('https://app.test/api/email-subscriptions/market-read', {
		method,
		headers: { origin }
	});
	request.headers.set('origin', origin);

	return {
		request,
		url: new URL('https://app.test/api/email-subscriptions/market-read'),
		locals: { principal: cookieSessionPrincipal('viewer') },
		fetch: vi.fn()
	} as never;
}

describe('/api/email-subscriptions/market-read', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			emailSubscriptions: { setMarketRead: mocks.setMarketRead }
		});
		mocks.setMarketRead.mockResolvedValue({
			data: { data: preference },
			response: new Response(null, { status: 200 })
		});
	});

	it.each([
		['POST', POST, { subscribed: true, consentSource: 'signup' }],
		['PUT', PUT, { subscribed: true, consentSource: 'account_settings' }],
		['DELETE', DELETE, { subscribed: false }]
	] as const)('maps %s to a server-owned Parchment payload', async (method, handler, payload) => {
		const event = makeEvent(method);
		const response = await handler(event);

		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.setMarketRead).toHaveBeenCalledWith(payload);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ data: preference });
	});

	it('blocks cross-site mutations before calling Parchment', async () => {
		const response = await POST(makeEvent('POST', 'https://evil.test'));

		expect(response.status).toBe(403);
		expect(mocks.setMarketRead).not.toHaveBeenCalled();
	});

	it('preserves Parchment errors without inventing subscription state', async () => {
		mocks.setMarketRead.mockResolvedValue({
			error: { error: { code: 'storage_unavailable', message: 'Try again later.' } },
			response: new Response(null, { status: 503 })
		});

		const response = await PUT(makeEvent('PUT'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: { code: 'storage_unavailable', message: 'Try again later.' }
		});
	});
});
