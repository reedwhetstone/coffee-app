import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';
import type { UserRole } from '$lib/types/auth.types';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mockCreateCheckoutSession = vi.fn();
const mockGetStripeCustomerId = vi.fn();
const mockGetStripe = vi.fn();
const mockIsDefinitiveCheckoutCreationFailure = vi.fn();
const mockAcquireCheckoutAdmission = vi.fn();
const mockPublishCheckoutAdmission = vi.fn();
const mockAbandonCheckoutAdmission = vi.fn();
const mockCheckoutAdmissionsEnabled = vi.fn();
const mockCheckoutPurchaseFingerprint = vi.fn();
const mockNormalizeCheckoutStripePriceIds = vi.fn();
const mockVerifyPublishedCheckoutReplay = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	createCheckoutSession: mockCreateCheckoutSession,
	getStripeCustomerId: mockGetStripeCustomerId,
	getStripe: mockGetStripe,
	isDefinitiveCheckoutCreationFailure: mockIsDefinitiveCheckoutCreationFailure
}));

vi.mock('$lib/server/billing/checkoutAdmissions', () => ({
	CHECKOUT_ADMISSION_METADATA: {
		admissionId: 'parchment_admission_id',
		requestId: 'checkout_request_id',
		purchaseFingerprint: 'checkout_purchase_fingerprint'
	},
	CheckoutAdmissionError: class CheckoutAdmissionError extends Error {
		constructor(
			message: string,
			public status: number,
			public payload: unknown
		) {
			super(message);
		}
	},
	acquireCheckoutAdmission: mockAcquireCheckoutAdmission,
	publishCheckoutAdmission: mockPublishCheckoutAdmission,
	abandonCheckoutAdmission: mockAbandonCheckoutAdmission,
	checkoutAdmissionsEnabled: mockCheckoutAdmissionsEnabled,
	checkoutPurchaseFingerprint: mockCheckoutPurchaseFingerprint,
	normalizeCheckoutStripePriceIds: mockNormalizeCheckoutStripePriceIds,
	verifyPublishedCheckoutReplay: mockVerifyPublishedCheckoutReplay
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockCreateCheckoutSession.mockResolvedValue({
		id: 'cs_test_123',
		clientSecret: 'cs_test_secret'
	});
	mockGetStripeCustomerId.mockResolvedValue(null);
	mockCheckoutAdmissionsEnabled.mockReturnValue(false);
	mockCheckoutPurchaseFingerprint.mockReturnValue('purchase-fingerprint');
	mockNormalizeCheckoutStripePriceIds.mockImplementation((priceIds: string[]) => priceIds);
	mockVerifyPublishedCheckoutReplay.mockReturnValue(true);
	mockAcquireCheckoutAdmission.mockResolvedValue({
		admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		status: 'creating',
		stripeSessionId: null
	});
	mockPublishCheckoutAdmission.mockResolvedValue({
		admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		status: 'published',
		stripeSessionId: 'cs_test_123'
	});
	mockIsDefinitiveCheckoutCreationFailure.mockReturnValue(false);
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
		role?: UserRole;
		existingSubscriptions?: Array<{ product_family: string; product_key: string; status: string }>;
		origin?: string;
		authorization?: string;
	} = {}
) {
	const {
		user = { id: 'user-123', email: 'viewer@example.com' },
		role = 'viewer',
		existingSubscriptions = [],
		origin = 'https://app.test',
		authorization
	} = options;
	const headers = new Headers({
		'Content-Type': 'application/json',
		origin
	});
	if (authorization) headers.set('Authorization', authorization);

	const request = new Request('https://app.test/api/stripe/create-checkout-session', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
	request.headers.set('origin', origin);
	return {
		request,
		url: new URL('https://app.test/api/stripe/create-checkout-session'),
		locals: {
			principal: user
				? cookieSessionPrincipal(role, { user: user as never })
				: anonymousPrincipal(),
			supabase: createSupabaseMock(existingSubscriptions),
			safeGetIdentity: vi.fn(async () =>
				user
					? {
							session: { access_token: 'cookie-token' },
							user
						}
					: { session: null, user: null }
			)
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

	it('rejects bearer or mixed credentials and cross-origin mutations', async () => {
		const body = {
			purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
			requestId: '11111111-1111-4111-8111-111111111111'
		};
		const bearer = await POST(makeEvent(body, { authorization: 'Bearer token' }));
		const crossOrigin = await POST(makeEvent(body, { origin: 'https://evil.test' }));

		expect(bearer.status).toBe(401);
		expect(crossOrigin.status).toBe(403);
		expect(mockAcquireCheckoutAdmission).not.toHaveBeenCalled();
	});

	it('acquires, creates with the admission idempotency key, then publishes before responding', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(true);
		const requestId = '11111111-1111-4111-8111-111111111111';

		const response = await POST(
			makeEvent({
				purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
				requestId
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret', requestId });
		expect(mockAcquireCheckoutAdmission).toHaveBeenCalledWith(expect.anything(), requestId);
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			['price_1TLTecKwI9NkGqAn07hkozWj'],
			null,
			'user-123',
			'viewer@example.com',
			'https://app.test',
			{
				admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				requestId,
				purchaseFingerprint: 'purchase-fingerprint'
			}
		);
		expect(mockPublishCheckoutAdmission).toHaveBeenCalledWith(
			expect.anything(),
			'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			'cs_test_123'
		);
		expect(mockAcquireCheckoutAdmission.mock.invocationCallOrder[0]).toBeLessThan(
			mockCreateCheckoutSession.mock.invocationCallOrder[0]
		);
		expect(mockCreateCheckoutSession.mock.invocationCallOrder[0]).toBeLessThan(
			mockPublishCheckoutAdmission.mock.invocationCallOrder[0]
		);
	});

	it('abandons only a definite no-session failure and retains ambiguous admissions', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(true);
		const request = {
			purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
			requestId: '11111111-1111-4111-8111-111111111111'
		};
		const definitive = Object.assign(new Error('bad request'), {
			type: 'StripeInvalidRequestError'
		});
		mockCreateCheckoutSession.mockRejectedValueOnce(definitive);
		mockIsDefinitiveCheckoutCreationFailure.mockReturnValueOnce(true);

		const rejected = await POST(makeEvent(request));
		expect(rejected.status).toBe(400);
		expect(mockAbandonCheckoutAdmission).toHaveBeenCalledWith(
			expect.anything(),
			'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
		);

		mockCreateCheckoutSession.mockRejectedValueOnce(new Error('socket reset'));
		mockIsDefinitiveCheckoutCreationFailure.mockReturnValueOnce(false);
		mockAbandonCheckoutAdmission.mockClear();
		const ambiguous = await POST(makeEvent(request));
		expect(ambiguous.status).toBe(503);
		expect((await ambiguous.json()).error.requestId).toBe(request.requestId);
		expect(mockAbandonCheckoutAdmission).not.toHaveBeenCalled();
	});

	it('replays an already-published admission by verifying the exact Stripe session', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(true);
		mockAcquireCheckoutAdmission.mockResolvedValue({
			admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			status: 'published',
			stripeSessionId: 'cs_existing'
		});
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					retrieve: vi.fn(async () => ({
						client_reference_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
						client_secret: 'cs_existing_secret',
						status: 'open',
						metadata: {
							parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
							checkout_request_id: requestId,
							checkout_purchase_fingerprint: 'purchase-fingerprint'
						}
					}))
				}
			}
		});
		const requestId = '11111111-1111-4111-8111-111111111111';

		const response = await POST(
			makeEvent({
				purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
				requestId
			})
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			clientSecret: 'cs_existing_secret',
			requestId
		});
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
		expect(mockPublishCheckoutAdmission).not.toHaveBeenCalled();
		expect(mockVerifyPublishedCheckoutReplay).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'open' }),
			expect.objectContaining({
				admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				requestId
			})
		);
	});

	it('rejects a published admission replay when the requested purchase set changed', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(true);
		mockVerifyPublishedCheckoutReplay.mockReturnValue(false);
		mockAcquireCheckoutAdmission.mockResolvedValue({
			admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			status: 'published',
			stripeSessionId: 'cs_existing'
		});
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					retrieve: vi.fn(async () => ({
						client_reference_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
						client_secret: 'cs_existing_secret',
						status: 'open',
						metadata: {
							parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
							checkout_request_id: '11111111-1111-4111-8111-111111111111',
							checkout_purchase_fingerprint: 'different-purchase-fingerprint'
						}
					}))
				}
			}
		});

		const response = await POST(
			makeEvent({
				purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
				requestId: '11111111-1111-4111-8111-111111111111'
			})
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: 'checkout_replay_mismatch',
				message: 'Checkout replay could not be verified'
			}
		});
		expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
	});

	it.each([409, 429, 503])('preserves structured upstream %s responses', async (status) => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(true);
		const { CheckoutAdmissionError } = await import('$lib/server/billing/checkoutAdmissions');
		const payload = { error: { code: `upstream_${status}`, message: 'Actionable failure' } };
		mockAcquireCheckoutAdmission.mockRejectedValue(
			new CheckoutAdmissionError('Actionable failure', status, payload)
		);
		const response = await POST(
			makeEvent({
				purchaseKeys: [BILLING_PURCHASE_KEYS.apiPlanMonthly],
				requestId: '11111111-1111-4111-8111-111111111111'
			})
		);
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual(payload);
	});
});
