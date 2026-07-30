import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConstructStripeEvent = vi.fn();
const mockCreateAdminSupabase = vi.fn();
const mockReconcileStripeSubscription = vi.fn();
const mockGetStripe = vi.fn();
const mockCheckoutAdmissionsEnabled = vi.fn();
const mockCheckoutProviderIsEligible = vi.fn();
const mockTerminalizeExpiredCheckoutAdmission = vi.fn();

vi.mock('$lib/services/stripe-webhook', () => ({
	constructStripeEvent: mockConstructStripeEvent,
	createAdminSupabase: mockCreateAdminSupabase,
	reconcileStripeSubscription: mockReconcileStripeSubscription
}));

vi.mock('$lib/services/stripe', () => ({
	getStripe: mockGetStripe
}));

vi.mock('$lib/server/billing/checkoutAdmissions', () => ({
	CheckoutAdmissionError: class CheckoutAdmissionError extends Error {
		constructor(
			message: string,
			public status: number,
			public payload?: unknown
		) {
			super(message);
		}
	},
	checkoutAdmissionsEnabled: mockCheckoutAdmissionsEnabled,
	legacyCheckoutDrainEnabled: vi.fn(() => false),
	checkoutAdmissionContextFromMetadata: (
		metadata: Record<string, string> | null,
		stripeSessionId: string
	) => {
		const ownerId = metadata?.supabase_user_id;
		const admissionId = metadata?.parchment_admission_id;
		const requestId = metadata?.checkout_request_id;
		if ((ownerId || admissionId || requestId) && (!ownerId || !admissionId)) {
			throw new Error('Managed checkout session is missing Checkout admission metadata');
		}
		return ownerId && admissionId ? { ownerId, admissionId, requestId, stripeSessionId } : null;
	},
	checkoutProviderIsEligible: mockCheckoutProviderIsEligible,
	terminalizeExpiredCheckoutAdmission: mockTerminalizeExpiredCheckoutAdmission
}));

let POST: typeof import('./+server').POST;

function makeEvent() {
	return {
		request: new Request('https://app.test/api/stripe/webhook', {
			method: 'POST',
			headers: { 'stripe-signature': 'valid-signature' },
			body: '{}'
		}),
		fetch
	} as unknown as Parameters<typeof POST>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockCheckoutAdmissionsEnabled.mockReturnValue(true);
	mockCheckoutProviderIsEligible.mockResolvedValue(true);
	mockCreateAdminSupabase.mockReturnValue({});
	({ POST } = await import('./+server'));
});

describe('Stripe webhook Checkout admission fence', () => {
	it('checks provider eligibility before external metadata or local billing writes', async () => {
		const customerUpdate = vi.fn();
		mockGetStripe.mockReturnValue({
			customers: { update: customerUpdate },
			subscriptions: { retrieve: vi.fn() }
		});
		mockCheckoutProviderIsEligible.mockResolvedValue(false);
		mockConstructStripeEvent.mockResolvedValue({
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_123',
					mode: 'subscription',
					client_reference_id: 'user-123',
					customer: 'cus_123',
					subscription: 'sub_123',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
					}
				}
			}
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(200);
		expect(mockCheckoutProviderIsEligible).toHaveBeenCalled();
		expect(customerUpdate).not.toHaveBeenCalled();
		expect(mockReconcileStripeSubscription).not.toHaveBeenCalled();
	});

	it('keeps managed sessions fenced after the rollout flag is disabled', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(false);
		mockCheckoutProviderIsEligible.mockResolvedValue(false);
		mockConstructStripeEvent.mockResolvedValue({
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_managed',
					mode: 'subscription',
					client_reference_id: 'user-123',
					customer: 'cus_123',
					subscription: 'sub_123',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
					}
				}
			}
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(200);
		expect(mockCheckoutProviderIsEligible).toHaveBeenCalled();
		expect(mockGetStripe).not.toHaveBeenCalled();
		expect(mockReconcileStripeSubscription).not.toHaveBeenCalled();
	});

	it('rejects partial admission metadata so Stripe retries the event', async () => {
		mockConstructStripeEvent.mockResolvedValue({
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_partial',
					metadata: { supabase_user_id: 'user-123' }
				}
			}
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(400);
		expect(mockGetStripe).not.toHaveBeenCalled();
		expect(mockReconcileStripeSubscription).not.toHaveBeenCalled();
	});

	it('terminalizes managed expired sessions after rollout disable and safely accepts replay', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(false);
		mockConstructStripeEvent.mockResolvedValue({
			type: 'checkout.session.expired',
			data: {
				object: {
					id: 'cs_expired',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
					}
				}
			}
		});
		mockTerminalizeExpiredCheckoutAdmission.mockResolvedValue({
			status: 'closed',
			stripeSessionId: 'cs_expired'
		});

		const first = await POST(makeEvent());
		const replay = await POST(makeEvent());

		expect(first.status).toBe(200);
		expect(replay.status).toBe(200);
		expect(mockTerminalizeExpiredCheckoutAdmission).toHaveBeenCalledTimes(2);
	});

	it('treats terminalization 409 as deletion-owned reconciliation', async () => {
		const { CheckoutAdmissionError } = await import('$lib/server/billing/checkoutAdmissions');
		mockConstructStripeEvent.mockResolvedValue({
			type: 'checkout.session.expired',
			data: {
				object: {
					id: 'cs_expired',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
					}
				}
			}
		});
		mockTerminalizeExpiredCheckoutAdmission.mockRejectedValue(
			new CheckoutAdmissionError('deletion owns reconciliation', 409, null)
		);

		const response = await POST(makeEvent());
		expect(response.status).toBe(200);
	});

	it.each(['customer.subscription.updated', 'customer.subscription.deleted'])(
		'reconciles legacy %s events after the open-session drain closes',
		async (type) => {
			mockConstructStripeEvent.mockResolvedValue({
				type,
				data: {
					object: {
						id: 'sub_legacy',
						metadata: {}
					}
				}
			});

			const response = await POST(makeEvent());

			expect(response.status).toBe(200);
			expect(mockCheckoutProviderIsEligible).not.toHaveBeenCalled();
			expect(mockReconcileStripeSubscription).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'sub_legacy' }),
				expect.anything()
			);
		}
	);

	it('keeps managed subscription events fenced after rollout disable', async () => {
		mockCheckoutAdmissionsEnabled.mockReturnValue(false);
		mockCheckoutProviderIsEligible.mockResolvedValue(false);
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					list: vi.fn(async () => ({ data: [{ id: 'cs_managed' }] }))
				}
			}
		});
		mockConstructStripeEvent.mockResolvedValue({
			type: 'customer.subscription.updated',
			data: {
				object: {
					id: 'sub_managed',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
						checkout_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
					}
				}
			}
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(200);
		expect(mockCheckoutProviderIsEligible).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				stripeSessionId: 'cs_managed'
			})
		);
		expect(mockReconcileStripeSubscription).not.toHaveBeenCalled();
	});

	it('fails retryably when managed subscription context cannot be resolved', async () => {
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					list: vi.fn(async () => ({ data: [] }))
				}
			}
		});
		mockConstructStripeEvent.mockResolvedValue({
			type: 'customer.subscription.updated',
			data: {
				object: {
					id: 'sub_managed',
					metadata: {
						supabase_user_id: 'user-123',
						parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
					}
				}
			}
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(400);
		expect(mockReconcileStripeSubscription).not.toHaveBeenCalled();
	});
});
