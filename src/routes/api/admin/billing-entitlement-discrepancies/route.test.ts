import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		discrepancies: vi.fn(),
		recompute: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient,
	ParchmentConfigError: mocks.ParchmentConfigError
}));

import { GET, POST } from './+server';

const userId = '11111111-1111-4111-8111-111111111111';

function makeEvent(method: 'GET' | 'POST', role: 'admin' | 'member' = 'admin') {
	const request = new Request('https://app.test/api/admin/billing-entitlement-discrepancies', {
		method,
		headers:
			method === 'POST'
				? { origin: 'https://app.test', 'content-type': 'application/json' }
				: undefined,
		body: method === 'POST' ? JSON.stringify({ ownerId: userId }) : undefined
	});
	if (method === 'POST') request.headers.set('origin', 'https://app.test');

	return {
		request,
		url: new URL('https://app.test/api/admin/billing-entitlement-discrepancies'),
		locals: { principal: cookieSessionPrincipal(role) },
		fetch: vi.fn()
	} as never;
}

describe('/api/admin/billing-entitlement-discrepancies', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createParchmentServerClient.mockResolvedValue({
			billingAdministration: {
				discrepancies: mocks.discrepancies,
				recompute: mocks.recompute
			}
		});
	});

	it('relays the bounded canonical discrepancy report for cookie-session admins', async () => {
		const report = {
			summary: {
				totalDiscrepancies: 1,
				totalTrackedAccounts: 3,
				checkedAt: '2026-08-14T17:00:00.000Z'
			},
			discrepancies: [
				{
					ownerId: userId,
					actual: { role: 'viewer', apiPlan: 'viewer', ppiAccess: false },
					expected: { role: 'member', apiPlan: 'member', ppiAccess: true }
				}
			]
		};
		mocks.discrepancies.mockResolvedValue({
			data: report,
			response: new Response(null, { status: 200 })
		});

		const response = await GET(makeEvent('GET'));

		expect(mocks.discrepancies).toHaveBeenCalledOnce();
		expect(await response.json()).toEqual(report);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('recomputes the bounded owner through Parchment', async () => {
		const result = {
			ownerId: userId,
			actual: { role: 'member', apiPlan: 'member', ppiAccess: true }
		};
		mocks.recompute.mockResolvedValue({
			data: result,
			response: new Response(null, { status: 200 })
		});

		const response = await POST(makeEvent('POST'));

		expect(mocks.recompute).toHaveBeenCalledWith(userId);
		expect(await response.json()).toEqual(result);
	});

	it('rejects a non-admin cookie session without calling Parchment', async () => {
		const response = await GET(makeEvent('GET', 'member'));

		expect(response.status).toBe(403);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(mocks.discrepancies).not.toHaveBeenCalled();
	});
});
