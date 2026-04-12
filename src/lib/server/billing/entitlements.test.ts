import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import {
	mapStripeSubscriptionToBillingSnapshotRows,
	recomputeUserBillingEntitlements,
	resolveBillingEntitlements,
	syncBillingSubscriptionSnapshotFromStripeSubscription
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
	it('grants member app access from an active membership subscription without changing explicit entitlements', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			currentApiPlan: 'viewer',
			currentPpiAccess: false,
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

	it('drops membership back to viewer when no active membership grants remain while preserving explicit entitlements', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'member',
			currentApiPlan: 'enterprise',
			currentPpiAccess: true,
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
			apiPlan: 'enterprise',
			ppiAccess: true
		});
	});

	it('preserves admin during membership reconciliation', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'admin',
			currentApiPlan: 'enterprise',
			currentPpiAccess: true,
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				}
			]
		});

		expect(resolved).toEqual({
			role: 'admin',
			userRole: ['admin'],
			apiPlan: 'enterprise',
			ppiAccess: true
		});
	});

	it('treats admin users with a null api_plan as enterprise during reconciliation', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'admin',
			currentApiPlan: null,
			currentPpiAccess: false,
			subscriptions: []
		});

		expect(resolved).toEqual({
			role: 'admin',
			userRole: ['admin'],
			apiPlan: 'enterprise',
			ppiAccess: false
		});
	});

	it('preserves an existing explicit api_plan during membership-only reconciliation', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			currentApiPlan: 'enterprise',
			currentPpiAccess: false,
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
			apiPlan: 'enterprise',
			ppiAccess: false
		});
	});

	it('preserves an existing explicit ppi_access during membership-only reconciliation', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			currentApiPlan: 'viewer',
			currentPpiAccess: true,
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
			ppiAccess: true
		});
	});

	it('repairs null explicit entitlements by persisting canonical defaults from shared recompute logic', async () => {
		const upsert = vi.fn(async () => ({ error: null }));
		const maybeSingle = vi.fn(async () => ({
			data: {
				role: 'viewer',
				user_role: ['viewer'],
				api_plan: null as never,
				ppi_access: null as never
			},
			error: null
		}));
		const eqUserRoles = vi.fn(() => ({ maybeSingle }));
		const selectUserRoles = vi.fn(() => ({ eq: eqUserRoles }));
		const selectBillingSubscriptions = vi.fn(() => ({
			eq: vi.fn(async () => ({ data: [], error: null }))
		}));
		const from = vi.fn((table: string) => {
			if (table === 'user_roles') {
				return {
					select: selectUserRoles,
					upsert
				};
			}

			if (table === 'billing_subscriptions') {
				return {
					select: selectBillingSubscriptions
				};
			}

			throw new Error(`Unexpected table lookup: ${table}`);
		});

		const result = await recomputeUserBillingEntitlements({ from } as never, 'user_123');

		expect(result.changed).toBe(true);
		expect(result.resolvedEntitlements).toEqual({
			role: 'viewer',
			userRole: ['viewer'],
			apiPlan: 'viewer',
			ppiAccess: false
		});
		expect(upsert).toHaveBeenCalledWith(
			{
				id: 'user_123',
				role: 'viewer',
				user_role: ['viewer'],
				api_plan: 'viewer',
				ppi_access: false,
				updated_at: expect.any(String)
			},
			{ onConflict: 'id' }
		);
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

	it('surfaces unknown Stripe prices during snapshot mapping', () => {
		const result = mapStripeSubscriptionToBillingSnapshotRows({
			userId: 'user_123',
			stripeCustomerId: 'cus_123',
			subscription: makeSubscription({}, 'price_unknown')
		});

		expect(result.rows).toEqual([]);
		expect(result.unknownPriceIds).toEqual(['price_unknown']);
	});

	it('fails safe before touching the billing snapshot when Stripe returns an unknown price', async () => {
		const from = vi.fn(() => {
			throw new Error('billing snapshot should not be queried or mutated on catalog drift');
		});
		const supabase = { from };

		await expect(
			syncBillingSubscriptionSnapshotFromStripeSubscription(supabase as never, {
				userId: 'user_123',
				stripeCustomerId: 'cus_123',
				subscription: makeSubscription({}, 'price_unknown')
			})
		).rejects.toMatchObject({
			name: 'BillingCatalogDriftError',
			unknownPriceIds: ['price_unknown']
		});

		expect(from).not.toHaveBeenCalled();
	});
});
