import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		mutate: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { PATCH } from './+server';

const subscriptionId = 'sub_opaque';
const mutation = {
	requestId: '11111111-1111-4111-8111-111111111111',
	cancelAtPeriodEnd: true
};

function makeEvent() {
	const request = new Request(`https://app.test/api/billing/subscriptions/${subscriptionId}`, {
		method: 'PATCH',
		headers: { origin: 'https://app.test', 'content-type': 'application/json' },
		body: JSON.stringify(mutation)
	});
	request.headers.set('origin', 'https://app.test');

	return {
		request,
		url: new URL(`https://app.test/api/billing/subscriptions/${subscriptionId}`),
		params: { subscriptionId },
		locals: { principal: cookieSessionPrincipal('member') },
		fetch: vi.fn()
	} as never;
}

describe('PATCH /api/billing/subscriptions/[subscriptionId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			billing: { subscriptions: { mutate: mocks.mutate } }
		});
	});

	it('forwards the stable mutation request and preserves a durable pending response', async () => {
		mocks.mutate.mockResolvedValue({
			data: {
				operationId: '22222222-2222-4222-8222-222222222222',
				cutoverId: '33333333-3333-4333-8333-333333333333',
				subscriptionId,
				cancelAtPeriodEnd: true,
				status: 'attempting',
				reason: null
			},
			response: new Response(null, { status: 202 })
		});

		const event = makeEvent();
		const response = await PATCH(event);

		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.mutate).toHaveBeenCalledWith(subscriptionId, mutation);
		expect(response.status).toBe(202);
		expect((await response.json()).status).toBe('attempting');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});
