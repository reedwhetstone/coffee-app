import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResumeSubscription = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	resumeSubscription: mockResumeSubscription
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockResumeSubscription.mockResolvedValue(true);
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
		request: new Request('https://app.test/api/stripe/resume-subscription', {
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

describe('/api/stripe/resume-subscription', () => {
	it.each(['active', 'past_due', 'incomplete', 'unpaid'])(
		'blocks bundled multi-family membership resume when another bundled product is %s',
		async (status) => {
			const response = await POST(
				makeEvent(
					{ subscriptionId: 'sub_bundle_123' },
					{
						billingSubscriptions: [
							{
								stripe_subscription_id: 'sub_bundle_123',
								product_family: 'membership',
								status
							},
							{
								stripe_subscription_id: 'sub_bundle_123',
								product_family: 'ppi_addon',
								status
							}
						]
					}
				)
			);

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({
				error:
					'Membership resume is unavailable for bundled subscriptions that also include API or Parchment Intelligence products.'
			});
			expect(mockResumeSubscription).not.toHaveBeenCalled();
		}
	);
});
