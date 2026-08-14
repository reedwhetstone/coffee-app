import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		get: vi.fn(),
		reconcile: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { GET, POST } from './+server';

const admissionId = '22222222-2222-4222-8222-222222222222';

function makeEvent(method: 'GET' | 'POST', origin = 'https://app.test') {
	const request = new Request(`https://app.test/api/billing/checkout-sessions/${admissionId}`, {
		method,
		headers: method === 'POST' ? { origin } : undefined
	});
	if (method === 'POST') request.headers.set('origin', origin);

	return {
		request,
		url: new URL(`https://app.test/api/billing/checkout-sessions/${admissionId}`),
		params: { admissionId },
		locals: { principal: cookieSessionPrincipal('member') },
		fetch: vi.fn()
	} as never;
}

describe('/api/billing/checkout-sessions/[admissionId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			billing: { checkout: { get: mocks.get, reconcile: mocks.reconcile } }
		});
	});

	it('loads owner-bound admission state without accepting a provider session identifier', async () => {
		mocks.get.mockResolvedValue({
			data: { admissionId, status: 'attempting', clientSecret: null },
			response: new Response(null, { status: 200 })
		});

		const response = await GET(makeEvent('GET'));

		expect(mocks.get).toHaveBeenCalledWith(admissionId);
		expect(await response.json()).toEqual({
			admissionId,
			status: 'attempting',
			clientSecret: null
		});
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('reconciles by admission ID and enforces exact same-origin', async () => {
		mocks.reconcile.mockResolvedValue({
			data: { admissionId, status: 'settled', clientSecret: null },
			response: new Response(null, { status: 200 })
		});

		const blocked = await POST(makeEvent('POST', 'https://evil.test'));
		const response = await POST(makeEvent('POST'));

		expect(blocked.status).toBe(403);
		expect(mocks.reconcile).toHaveBeenCalledOnce();
		expect(mocks.reconcile).toHaveBeenCalledWith(admissionId);
		expect(await response.json()).toEqual({ admissionId, status: 'settled', clientSecret: null });
	});
});
