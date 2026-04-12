import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

const mockCreateCheckoutSession = vi.fn();
const mockGetStripeCustomerId = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	createCheckoutSession: mockCreateCheckoutSession,
	getStripeCustomerId: mockGetStripeCustomerId
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockCreateCheckoutSession.mockResolvedValue('cs_test_secret');
	mockGetStripeCustomerId.mockResolvedValue(null);
});

function createSupabaseMock(
	existingSubscriptions: Array<{ product_family: string; product_key: string; status: string }> = []
) {
	const eq = vi.fn(async () => ({ data: existingSubscriptions, error: null }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn((table: string) => {
		if (table !== 'billing_subscriptions') {
			throw new Error(`Unexpected table lookup: ${table}`);
		}

		return { select };
	});

	return { from };
}

function makeEvent(
	body: unknown,
	options: {
		user?: { id: string; email?: string } | null;
		role?: App.Locals['role'];
		existingSubscriptions?: Array<{ product_family: string; product_key: string; status: string }>;
	} = {}
) {
	const {
		user = { id: 'user-123', email: 'viewer@example.com' },
		role = 'viewer',
		existingSubscriptions = []
	} = options;

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
			safeGetSession: vi.fn().mockResolvedValue({ user, role, roles: [role] }),
			supabase: createSupabaseMock(existingSubscriptions)
		}
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/stripe/create-checkout-session', () => {
	it('requires an authenticated user', async () => {
		const response = await POST(
			makeEvent({ purchaseKeys: [BILLING_PURCHASE_KEYS.membershipMonthly] }, { user: null })
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
		const response = await POST(makeEvent({ purchaseKeys: ['membership.lifetime'] }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Unknown purchase key: membership.lifetime' });
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects enterprise from self-serve checkout', async () => {
		const response = await POST(
			makeEvent({ purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanEnterprise] })
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error:
				'Enterprise for Parchment API is not available through self-serve checkout. Contact sales.'
		});
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects conflicting same-family purchase keys in the same request', async () => {
		const response = await POST(
			makeEvent({
				purchaseKeys: [
					BILLING_PURCHASE_KEYS.membershipMonthly,
					BILLING_PURCHASE_KEYS.membershipAnnual
				]
			})
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error:
				'Choose only one Mallard Studio plan per checkout. Same-family interval changes must be managed outside checkout.'
		});
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects conflicting same-family purchases when an active subscription already exists', async () => {
		const response = await POST(
			makeEvent(
				{ purchaseKeys: [BILLING_PURCHASE_KEYS.ppiAddonAnnual] },
				{
					existingSubscriptions: [
						{
							product_family: 'ppi_addon',
							product_key: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
							status: 'active'
						}
					]
				}
			)
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error:
				'You already have an active Parchment Intelligence subscription. Use subscription management to change intervals.'
		});
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it.each(['past_due', 'incomplete', 'unpaid'])(
		'rejects conflicting same-family purchases when the existing subscription is %s',
		async (status) => {
			const response = await POST(
				makeEvent(
					{ purchaseKeys: [BILLING_PURCHASE_KEYS.ppiAddonAnnual] },
					{
						existingSubscriptions: [
							{
								product_family: 'ppi_addon',
								product_key: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
								status
							}
						]
					}
				)
			);

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({
				error:
					'You already have an active Parchment Intelligence subscription. Use subscription management to change intervals.'
			});
			expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
		}
	);

	it('allows a same-family purchase when the existing subscription is terminal', async () => {
		const response = await POST(
			makeEvent(
				{ purchaseKeys: [BILLING_PURCHASE_KEYS.membershipMonthly] },
				{
					existingSubscriptions: [
						{
							product_family: 'membership',
							product_key: BILLING_PURCHASE_KEYS.membershipAnnual,
							status: 'canceled'
						}
					]
				}
			)
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' });
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			['price_1RgGYuKwI9NkGqAnm4oiHpbx'],
			null,
			'user-123',
			'viewer@example.com',
			'https://app.test'
		);
	});

	it('allows cross-family purchases and maps purchase keys to Stripe price IDs', async () => {
		const response = await POST(
			makeEvent({
				purchaseKeys: [
					BILLING_PURCHASE_KEYS.membershipMonthly,
					BILLING_PURCHASE_KEYS.apiPlanMonthly,
					BILLING_PURCHASE_KEYS.ppiAddonAnnual
				]
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' });
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			[
				'price_1RgGYuKwI9NkGqAnm4oiHpbx',
				'price_1TLTecKwI9NkGqAn07hkozWj',
				'price_1TLTihKwI9NkGqAnxqhgpLN1'
			],
			null,
			'user-123',
			'viewer@example.com',
			'https://app.test'
		);
	});

	it('allows adding a cross-family purchase when another family is already active', async () => {
		const response = await POST(
			makeEvent(
				{ purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly] },
				{
					existingSubscriptions: [
						{
							product_family: 'membership',
							product_key: BILLING_PURCHASE_KEYS.membershipAnnual,
							status: 'active'
						}
					]
				}
			)
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' });
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			['price_1TLTecKwI9NkGqAn07hkozWj'],
			null,
			'user-123',
			'viewer@example.com',
			'https://app.test'
		);
	});

	it('reuses an existing Stripe customer mapping during checkout', async () => {
		mockGetStripeCustomerId.mockResolvedValue('cus_existing_123');

		const response = await POST(
			makeEvent({ purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly] })
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' });
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			['price_1TLTecKwI9NkGqAn07hkozWj'],
			'cus_existing_123',
			'user-123',
			'viewer@example.com',
			'https://app.test'
		);
	});
});
