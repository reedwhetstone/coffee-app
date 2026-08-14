import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		create: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { POST } from './+server';

const requestBody = {
	requestId: '11111111-1111-4111-8111-111111111111',
	purchaseItems: [
		{ purchaseKey: 'membership.monthly', quantity: 1 },
		{ purchaseKey: 'ppi.annual', quantity: 2 }
	]
};

function makeEvent(body: unknown = requestBody) {
	const request = new Request('https://app.test/api/billing/checkout-sessions', {
		method: 'POST',
		headers: { origin: 'https://app.test', 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	request.headers.set('origin', 'https://app.test');

	return {
		request,
		url: new URL('https://app.test/api/billing/checkout-sessions'),
		locals: { principal: cookieSessionPrincipal('member') },
		fetch: vi.fn()
	} as never;
}

describe('POST /api/billing/checkout-sessions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			billing: { checkout: { create: mocks.create } }
		});
		mocks.create.mockResolvedValue({
			data: {
				admissionId: '22222222-2222-4222-8222-222222222222',
				status: 'published',
				clientSecret: 'cs_test_secret'
			},
			response: new Response(null, { status: 200 })
		});
	});

	it('forwards only the SDK 0.28 checkout contract and returns the opaque admission result', async () => {
		const event = makeEvent();
		const response = await POST(event);

		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.create).toHaveBeenCalledWith(requestBody);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			admissionId: '22222222-2222-4222-8222-222222222222',
			status: 'published',
			clientSecret: 'cs_test_secret'
		});
	});

	it('preserves the upstream error status and envelope', async () => {
		mocks.create.mockResolvedValue({
			error: { error: { code: 'checkout_conflict', message: 'Checkout conflict.' } },
			response: new Response(null, { status: 409 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: { code: 'checkout_conflict', message: 'Checkout conflict.' }
		});
	});
});
