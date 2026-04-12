import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetStripeCustomerId = vi.fn();
const mockGetSubscriptionDetails = vi.fn();

vi.mock('$lib/services/stripe', () => ({
	getStripeCustomerId: mockGetStripeCustomerId,
	getSubscriptionDetails: mockGetSubscriptionDetails
}));

let load: typeof import('./+page.server').load;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ load } = await import('./+page.server'));
	mockGetStripeCustomerId.mockResolvedValue('cus_123');
	mockGetSubscriptionDetails.mockResolvedValue(null);
});

function createSupabaseMock(
	billingSubscriptions: Array<{
		stripe_subscription_id: string;
		product_family: string;
		product_key: string;
		status: string;
		cancel_at_period_end: boolean;
		current_period_end: string | null;
	}> = []
) {
	const eq = vi.fn(async () => ({ data: billingSubscriptions, error: null }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn((table: string) => {
		if (table !== 'billing_subscriptions') {
			throw new Error(`Unexpected table lookup: ${table}`);
		}

		return { select };
	});

	return { from };
}

function makeLoadInput(
	billingSubscriptions: Array<{
		stripe_subscription_id: string;
		product_family: string;
		product_key: string;
		status: string;
		cancel_at_period_end: boolean;
		current_period_end: string | null;
	}> = []
) {
	const user = { id: 'user-123', email: 'member@example.com' };
	const session = { user } as App.Locals['session'];

	return {
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({ session, user }),
			role: 'viewer',
			principal: {
				apiPlan: 'viewer',
				ppiAccess: false
			},
			supabase: createSupabaseMock(billingSubscriptions)
		}
	} as unknown as Parameters<typeof load>[0];
}

describe('/subscription page server load', () => {
	it('loads Stripe subscription details for each product family', async () => {
		const result = (await load(
			makeLoadInput([
				{
					stripe_subscription_id: 'sub_bundle_123',
					product_family: 'api_plan',
					product_key: 'api_plan.monthly',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2026-05-01T00:00:00.000Z'
				}
			])
		)) as {
			controlPlane: {
				api: {
					resolvedPlanName: string;
				};
			} | null;
		};

		expect(mockGetStripeCustomerId).toHaveBeenCalledWith('user-123');
		expect(mockGetSubscriptionDetails).toHaveBeenNthCalledWith(1, 'cus_123', {
			productFamily: 'membership'
		});
		expect(mockGetSubscriptionDetails).toHaveBeenNthCalledWith(2, 'cus_123', {
			productFamily: 'api_plan'
		});
		expect(mockGetSubscriptionDetails).toHaveBeenNthCalledWith(3, 'cus_123', {
			productFamily: 'ppi_addon'
		});
		expect(result.controlPlane?.api.resolvedPlanName).toBe('Parchment API');
	});

	it('marks bundled multi-family Mallard Studio subscriptions as not manageable', async () => {
		mockGetSubscriptionDetails
			.mockResolvedValueOnce({
				id: 'sub_bundle_123',
				status: 'active',
				current_period_end: 1_777_600_000,
				cancel_at_period_end: false,
				plan: {
					name: 'Mallard Studio Member',
					amount: 900,
					interval: 'month',
					interval_count: 1
				}
			})
			.mockResolvedValueOnce({
				id: 'sub_bundle_123',
				status: 'active',
				current_period_end: 1_777_600_000,
				cancel_at_period_end: false,
				plan: {
					name: 'Parchment API',
					amount: 9900,
					interval: 'month',
					interval_count: 1
				}
			})
			.mockResolvedValueOnce(null);

		const result = (await load(
			makeLoadInput([
				{
					stripe_subscription_id: 'sub_bundle_123',
					product_family: 'membership',
					product_key: 'membership.monthly',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2026-05-01T00:00:00.000Z'
				},
				{
					stripe_subscription_id: 'sub_bundle_123',
					product_family: 'api_plan',
					product_key: 'api_plan.monthly',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2026-05-01T00:00:00.000Z'
				}
			])
		)) as {
			controlPlane: {
				membership: {
					canManageSubscription: boolean;
					managementBlockedReason: string | null;
				};
				api: {
					resolvedPlanName: string;
				};
			} | null;
		};

		expect(result.controlPlane?.membership.canManageSubscription).toBe(false);
		expect(result.controlPlane?.membership.managementBlockedReason).toContain('Parchment API');
		expect(result.controlPlane?.api.resolvedPlanName).toBe('Parchment API');
	});

	it('surfaces active intelligence Stripe access even when stored principal access is stale', async () => {
		mockGetSubscriptionDetails
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({
				id: 'sub_ppi_123',
				status: 'active',
				current_period_end: 1_777_600_000,
				cancel_at_period_end: false,
				plan: {
					name: 'Parchment Intelligence',
					amount: 3900,
					interval: 'month',
					interval_count: 1
				}
			});

		const result = (await load(makeLoadInput())) as {
			controlPlane: {
				intelligence: {
					enabled: boolean;
					statusLabel: string;
					currentPlan: {
						name: string;
					} | null;
				};
			} | null;
		};

		expect(result.controlPlane?.intelligence).toMatchObject({
			enabled: true,
			statusLabel: 'Intelligence active'
		});
		expect(result.controlPlane?.intelligence.currentPlan?.name).toBe('Parchment Intelligence');
	});

	it('skips Stripe lookups when the user has no Stripe customer id', async () => {
		mockGetStripeCustomerId.mockResolvedValueOnce(null);

		const result = (await load(makeLoadInput())) as {
			stripeCustomerId: string | null;
			controlPlane: {
				membership: {
					currentPlan: null;
				};
			};
		};

		expect(result.stripeCustomerId).toBeNull();
		expect(mockGetSubscriptionDetails).not.toHaveBeenCalled();
		expect(result.controlPlane.membership.currentPlan).toBeNull();
	});
});
