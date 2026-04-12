import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

const mockCreateCheckoutSession = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	createCheckoutSession: mockCreateCheckoutSession
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockCreateCheckoutSession.mockResolvedValue('cs_test_secret');
});

function makeEvent(
	body: unknown,
	options: {
		user?: { id: string; email?: string } | null;
		role?: App.Locals['role'];
	} = {}
) {
	const { user = { id: 'user-123', email: 'viewer@example.com' }, role = 'viewer' } = options;

	return {
		request: new Request('https://app.test/api/stripe/create-checkout-session', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				origin: 'https://app.test'
			},
			body: JSON.stringify(body)
		}),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({ user, role, roles: [role] })
		}
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/stripe/create-checkout-session', () => {
	it('requires an authenticated user', async () => {
		const response = await POST(
			makeEvent({ purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly }, { user: null })
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects requests without a purchase key', async () => {
		const response = await POST(makeEvent({}));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Missing required purchase key' });
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects unknown purchase keys', async () => {
		const response = await POST(makeEvent({ purchaseKey: 'membership.lifetime' }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Unknown purchase key' });
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it.each(['member', 'admin'] as const)(
		'rejects valid membership purchase keys for ineligible %s users',
		async (role) => {
			const response = await POST(
				makeEvent(
					{ purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual },
					{
						role,
						user: { id: 'user-123', email: `${role}@example.com` }
					}
				)
			);

			expect(response.status).toBe(403);
			expect(await response.json()).toEqual({
				error:
					'You already have membership access. Use subscription management for existing memberships.'
			});
			expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
		}
	);

	it('maps purchase keys to the server-side billing catalog before creating checkout', async () => {
		const response = await POST(
			makeEvent({ purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly })
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' });
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			'price_1RgGYuKwI9NkGqAnm4oiHpbx',
			null,
			'user-123',
			'viewer@example.com',
			'https://app.test'
		);
	});
});
