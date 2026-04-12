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
	it('requests only membership-family Stripe subscription details for management', async () => {
		const result = (await load(
			makeLoadInput([
				{
					product_family: 'api_plan',
					product_key: 'api_plan.monthly',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2026-05-01T00:00:00.000Z'
				}
			])
		)) as {
			subscription: null;
			controlPlane: {
				membership: {
					canManageSubscription: boolean;
				};
			} | null;
		};

		expect(mockGetStripeCustomerId).toHaveBeenCalledWith('user-123');
		expect(mockGetSubscriptionDetails).toHaveBeenCalledWith('cus_123', {
			productFamily: 'membership'
		});
		expect(result.subscription).toBeNull();
		expect(result.controlPlane?.membership.canManageSubscription).toBe(false);
	});
});
