import { describe, expect, it } from 'vitest';

import { buildSubscriptionControlPlaneState } from './control-plane';

describe('subscription control plane state', () => {
	it('shows a viewer account as Mallard Studio free baseline, Explorer, and locked intelligence', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'viewer',
			apiPlan: 'viewer',
			ppiAccess: false,
			billingSubscriptions: [],
			stripeSubscriptions: {
				membership: null,
				api: null,
				intelligence: null
			}
		});

		expect(state.membership).toMatchObject({
			hasAccess: false,
			statusLabel: 'Viewer baseline',
			canManageSubscription: false
		});
		expect(state.api).toMatchObject({
			plan: 'viewer',
			resolvedPlanName: 'Explorer',
			hasPaidPlan: false,
			statusLabel: 'Explorer baseline active'
		});
		expect(state.api.currentPlan).toMatchObject({
			name: 'Explorer',
			priceLabel: 'Free'
		});
		expect(state.intelligence).toMatchObject({
			enabled: false,
			statusLabel: 'Locked'
		});
		expect(state.membership.availablePlans).toHaveLength(2);
		expect(state.intelligence.availablePlans).toHaveLength(2);
	});

	it('shows a canceling Mallard Studio subscription with safe management controls', () => {
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
			stripeSubscriptions: {
				membership: {
					id: 'sub_123',
					status: 'active',
					current_period_end: 1_777_600_000,
					cancel_at_period_end: true,
					plan: {
						name: 'Mallard Studio Member',
						amount: 900,
						interval: 'month',
						interval_count: 1
					}
				},
				api: null,
				intelligence: null
			}
		});

		expect(state.membership).toMatchObject({
			hasAccess: true,
			statusLabel: 'Mallard Studio active, canceling at period end',
			canManageSubscription: true
		});
		expect(state.membership.currentPlan).toMatchObject({
			name: 'Mallard Studio Member',
			priceLabel: '$9/month',
			cancelAtPeriodEnd: true,
			subscriptionId: 'sub_123'
		});
		expect(state.membership.sourceLabel).toContain('set to cancel at period end');
	});

	it.each(['active', 'past_due'])(
		'blocks Mallard Studio management when the Stripe subscription also carries another %s product family',
		(otherFamilyStatus) => {
			const state = buildSubscriptionControlPlaneState({
				role: 'member',
				apiPlan: 'member',
				ppiAccess: false,
				billingSubscriptions: [
					{
						stripe_subscription_id: 'sub_bundle_123',
						product_family: 'membership',
						product_key: 'membership.monthly',
						status: otherFamilyStatus,
						cancel_at_period_end: false,
						current_period_end: '2026-05-01T00:00:00.000Z'
					},
					{
						stripe_subscription_id: 'sub_bundle_123',
						product_family: 'api_plan',
						product_key: 'api_plan.monthly',
						status: otherFamilyStatus,
						cancel_at_period_end: false,
						current_period_end: '2026-05-01T00:00:00.000Z'
					}
				],
				stripeSubscriptions: {
					membership: {
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
					},
					api: {
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
					},
					intelligence: null
				}
			});

			expect(state.membership.canManageSubscription).toBe(false);
			expect(state.membership.managementBlockedReason).toContain('Parchment API');
		}
	);

	it('shows a paid API user and active intelligence user as separate product families', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'viewer',
			apiPlan: 'member',
			ppiAccess: true,
			billingSubscriptions: [
				{
					stripe_subscription_id: 'sub_api_123',
					product_family: 'api_plan',
					product_key: 'api_plan.monthly',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2026-05-01T00:00:00.000Z'
				},
				{
					stripe_subscription_id: 'sub_ppi_123',
					product_family: 'ppi_addon',
					product_key: 'ppi_addon.annual',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: '2027-04-01T00:00:00.000Z'
				}
			],
			stripeSubscriptions: {
				membership: null,
				api: {
					id: 'sub_api_123',
					status: 'active',
					current_period_end: 1_777_600_000,
					cancel_at_period_end: false,
					plan: {
						name: 'Parchment API',
						amount: 9900,
						interval: 'month',
						interval_count: 1
					}
				},
				intelligence: {
					id: 'sub_ppi_123',
					status: 'active',
					current_period_end: 1_809_216_000,
					cancel_at_period_end: false,
					plan: {
						name: 'Parchment Intelligence',
						amount: 35000,
						interval: 'year',
						interval_count: 1
					}
				}
			}
		});

		expect(state.api).toMatchObject({
			plan: 'member',
			resolvedPlanName: 'Parchment API',
			hasPaidPlan: true,
			statusLabel: 'Paid API active'
		});
		expect(state.api.currentPlan).toMatchObject({
			name: 'Parchment API',
			priceLabel: '$99/month'
		});
		expect(state.intelligence).toMatchObject({
			enabled: true,
			statusLabel: 'Intelligence active'
		});
		expect(state.intelligence.currentPlan).toMatchObject({
			name: 'Parchment Intelligence',
			priceLabel: '$350/year'
		});
	});

	it('preserves admin messaging while surfacing enterprise API access', () => {
		const state = buildSubscriptionControlPlaneState({
			role: 'admin',
			apiPlan: 'enterprise',
			ppiAccess: true,
			billingSubscriptions: [],
			stripeSubscriptions: {
				membership: null,
				api: null,
				intelligence: null
			}
		});

		expect(state.membership).toMatchObject({
			hasAccess: true,
			statusLabel: 'Admin access'
		});
		expect(state.membership.sourceLabel).toContain('Admin access');
		expect(state.api).toMatchObject({
			plan: 'enterprise',
			resolvedPlanName: 'Enterprise',
			statusLabel: 'Enterprise access'
		});
		expect(state.enterprise.statusLabel).toBe('Contact sales');
	});
});
