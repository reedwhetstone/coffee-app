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
	user: { id: string; email?: string } | null = { id: 'user-123', email: 'member@example.com' }
) {
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
			safeGetSession: vi.fn().mockResolvedValue({ user })
		}
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/stripe/create-checkout-session', () => {
	it('requires an authenticated user', async () => {
		const response = await POST(
			makeEvent({ purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly }, null)
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
			'member@example.com',
			'https://app.test'
		);
	});
});
