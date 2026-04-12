import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import {
	mapStripeSubscriptionToBillingSnapshotRows,
	resolveBillingEntitlements
} from './entitlements';

function makeSubscription(
	overrides: Partial<Stripe.Subscription> = {},
	priceId = 'price_1RgGYuKwI9NkGqAnm4oiHpbx'
): Stripe.Subscription {
	return {
		id: 'sub_123',
		customer: 'cus_123',
		status: 'active',
		cancel_at_period_end: false,
		current_period_end: 1_700_000_000,
		items: {
			data: [
				{
					id: 'si_123',
					quantity: 1,
					price: {
						id: priceId,
						product: 'prod_123'
					}
				}
			]
		} as Stripe.ApiList<Stripe.SubscriptionItem>,
		...overrides
	} as Stripe.Subscription;
}

describe('billing entitlement reconciliation', () => {
	it('grants member app access from an active membership subscription without changing other entitlements', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				}
			]
		});

		expect(resolved).toEqual({
			role: 'member',
			userRole: ['member'],
			apiPlan: 'viewer',
			ppiAccess: false
		});
	});

	it('falls back to safe viewer defaults when no active grants remain', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'member',
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipAnnual,
					status: 'canceled'
				}
			]
		});

		expect(resolved).toEqual({
			role: 'viewer',
			userRole: ['viewer'],
			apiPlan: 'viewer',
			ppiAccess: false
		});
	});

	it('preserves admin while still resetting explicit add-on entitlements to safe defaults', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'admin',
			subscriptions: []
		});

		expect(resolved).toEqual({
			role: 'admin',
			userRole: ['admin'],
			apiPlan: 'viewer',
			ppiAccess: false
		});
	});

	it('maps Stripe subscription items into local billing snapshot rows', () => {
		const result = mapStripeSubscriptionToBillingSnapshotRows({
			userId: 'user_123',
			stripeCustomerId: 'cus_123',
			subscription: makeSubscription()
		});

		expect(result.deletedItemIds).toEqual([]);
		expect(result.unknownPriceIds).toEqual([]);
		expect(result.rows).toEqual([
			expect.objectContaining({
				user_id: 'user_123',
				stripe_customer_id: 'cus_123',
				stripe_subscription_id: 'sub_123',
				stripe_subscription_item_id: 'si_123',
				stripe_price_id: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
				product_family: 'membership',
				product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
				status: 'active',
				cancel_at_period_end: false
			})
		]);
	});

	it('ignores unknown Stripe prices when building the local billing snapshot', () => {
		const result = mapStripeSubscriptionToBillingSnapshotRows({
			userId: 'user_123',
			stripeCustomerId: 'cus_123',
			subscription: makeSubscription({}, 'price_unknown')
		});

		expect(result.rows).toEqual([]);
		expect(result.unknownPriceIds).toEqual(['price_unknown']);
	});
});
