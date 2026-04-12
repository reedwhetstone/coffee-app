import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCancelSubscription = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	cancelSubscription: mockCancelSubscription
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockCancelSubscription.mockResolvedValue(true);
});

function createSupabaseMock(
	billingSubscriptions: Array<{
		stripe_subscription_id: string;
		product_family: string;
		status: string;
	}> = []
) {
	const eqSubscriptionId = vi.fn(async () => ({ data: billingSubscriptions, error: null }));
	const eqUserId = vi.fn(() => ({ eq: eqSubscriptionId }));
	const select = vi.fn(() => ({ eq: eqUserId }));
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
		user?: { id: string } | null;
		billingSubscriptions?: Array<{
			stripe_subscription_id: string;
			product_family: string;
			status: string;
		}>;
	} = {}
) {
	const { user = { id: 'user-123' }, billingSubscriptions = [] } = options;

	return {
		request: new Request('https://app.test/api/stripe/cancel-subscription', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		}),
		locals: {
			session: user ? { user } : null,
			supabase: createSupabaseMock(billingSubscriptions)
		}
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/stripe/cancel-subscription', () => {
	it('blocks bundled multi-family membership cancellation so other products are not canceled', async () => {
		const response = await POST(
			makeEvent(
				{ subscriptionId: 'sub_bundle_123' },
				{
					billingSubscriptions: [
						{
							stripe_subscription_id: 'sub_bundle_123',
							product_family: 'membership',
							status: 'active'
						},
						{
							stripe_subscription_id: 'sub_bundle_123',
							product_family: 'api_plan',
							status: 'active'
						}
					]
				}
			)
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error:
				'Membership cancelation is unavailable for bundled subscriptions that also include API or Parchment Intelligence products.'
		});
		expect(mockCancelSubscription).not.toHaveBeenCalled();
	});
});
