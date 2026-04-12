import { describe, expect, it } from 'vitest';

import { buildSubscriptionControlPlaneState } from './control-plane';

describe('subscription control plane state', () => {
	it('shows a viewer account as free membership with baseline API and no PPI access', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'viewer',
			apiPlan: 'viewer',
			ppiAccess: false,
			billingSubscriptions: [],
			stripeSubscription: null
		});

		expect(state.membership).toMatchObject({
			hasAccess: false,
			statusLabel: 'Free viewer access',
			canManageSubscription: false
		});
		expect(state.api).toMatchObject({
			plan: 'viewer',
			statusLabel: 'Viewer API access'
		});
		expect(state.ppi).toMatchObject({
			enabled: false,
			statusLabel: 'PPI access not enabled'
		});
	});

	it('shows a canceling membership as still active with Stripe-backed source messaging', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'member',
			apiPlan: 'viewer',
			ppiAccess: false,
			billingSubscriptions: [
				{
					stripe_subscription_id: 'sub_123',
					product_family: 'membership',
					product_key: 'membership.monthly',
					status: 'active',
					cancel_at_period_end: true,
					current_period_end: '2026-05-01T00:00:00.000Z'
				}
			],
			stripeSubscription: {
				id: 'sub_123',
				status: 'active',
				current_period_end: 1_777_600_000,
				cancel_at_period_end: true,
				plan: {
					name: 'Roaster Plan',
					amount: 900,
					interval: 'month',
					interval_count: 1
				}
			}
		});

		expect(state.membership).toMatchObject({
			hasAccess: true,
			statusLabel: 'Membership active, canceling at period end',
			canManageSubscription: true,
			cancelAtPeriodEnd: true,
			stripeStatus: 'active'
		});
		expect(state.membership.sourceLabel).toContain('set to cancel at period end');
	});

	it('blocks membership management when the Stripe subscription also carries another active product family', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'member',
			apiPlan: 'member',
			ppiAccess: false,
			billingSubscriptions: [
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
			],
			stripeSubscription: {
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
			}
		});

		expect(state.membership.canManageSubscription).toBe(false);
		expect(state.membership.managementBlockedReason).toContain('also contains API');
	});

	it('preserves admin messaging while surfacing enterprise API access', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'admin',
			apiPlan: 'enterprise',
			ppiAccess: true,
			billingSubscriptions: [],
			stripeSubscription: null
		});

		expect(state.membership).toMatchObject({
			hasAccess: true,
			statusLabel: 'Admin access'
		});
		expect(state.membership.sourceLabel).toContain('Admin access');
		expect(state.api).toMatchObject({
			plan: 'enterprise',
			statusLabel: 'Enterprise API access'
		});
		expect(state.ppi).toMatchObject({
			enabled: true,
			statusLabel: 'PPI access enabled'
		});
	});
});
