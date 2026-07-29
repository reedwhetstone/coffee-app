import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import {
	mapStripeSubscriptionToBillingSnapshotRows,
	recomputeUserBillingEntitlements,
	resolveBillingEntitlements,
	syncBillingSubscriptionSnapshotFromStripeSubscription
} from './entitlements';

type StoredEntitlementRow = {
	role: 'admin' | 'member' | 'viewer' | null;
	api_plan: 'enterprise' | 'member' | 'viewer' | null;
	ppi_access: boolean | null;
};

function createRecomputeMock(input: {
	roleReads: Array<StoredEntitlementRow | null>;
	casResults?: Array<'success' | 'conflict'>;
	authorityChecks?: Array<boolean>;
	subscriptions?: Array<{ product_key: string; status: string }>;
}) {
	const roleReads = [...input.roleReads];
	const casResults = [...(input.casResults ?? [])];
	const authorityChecks = [...(input.authorityChecks ?? [])];
	const updates: Array<Record<string, unknown>> = [];
	const predicates: Array<Array<{ method: 'eq' | 'is'; column: string; value: unknown }>> = [];

	const from = vi.fn((table: string) => {
		if (table === 'billing_subscriptions') {
			return {
				select: vi.fn(() => ({
					eq: vi.fn(async () => ({ data: input.subscriptions ?? [], error: null }))
				}))
			};
		}

		if (table !== 'user_roles') {
			throw new Error(`Unexpected table lookup: ${table}`);
		}

		return {
			select: vi.fn((columns: string) => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => {
						if (columns === 'id') {
							return {
								data: authorityChecks.shift() ? { id: 'user_123' } : null,
								error: null
							};
						}

						return { data: roleReads.shift() ?? null, error: null };
					})
				}))
			})),
			update: vi.fn((payload: Record<string, unknown>) => {
				updates.push(payload);
				const updatePredicates: Array<{
					method: 'eq' | 'is';
					column: string;
					value: unknown;
				}> = [];
				predicates.push(updatePredicates);

				const builder = {
					eq: vi.fn((column: string, value: unknown) => {
						updatePredicates.push({ method: 'eq', column, value });
						return builder;
					}),
					is: vi.fn((column: string, value: unknown) => {
						updatePredicates.push({ method: 'is', column, value });
						return builder;
					}),
					select: vi.fn(() => ({
						maybeSingle: vi.fn(async () => ({
							data: casResults.shift() === 'success' ? { id: 'user_123' } : null,
							error: null
						}))
					}))
				};

				return builder;
			})
		};
	});

	return { supabase: { from } as never, from, updates, predicates };
}

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
			apiPlan: 'enterprise',
			ppiAccess: true
		});
	});

	it('grants paid API access from an active API subscription', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			currentApiPlan: 'viewer',
			currentPpiAccess: false,
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.apiPlanMonthly,
					status: 'active'
				}
			]
		});

		expect(resolved).toEqual({
			role: 'viewer',
			apiPlan: 'member',
			ppiAccess: false
		});
	});

	it('merges cross-family active subscriptions into a combined entitlement bundle', () => {
		const resolved = resolveBillingEntitlements({
			currentRole: 'viewer',
			currentApiPlan: 'viewer',
			currentPpiAccess: false,
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				},
				{
					product_key: BILLING_PURCHASE_KEYS.apiPlanMonthly,
					status: 'active'
				},
				{
					product_key: BILLING_PURCHASE_KEYS.ppiAddonAnnual,
					status: 'active'
				}
			]
		});

		expect(resolved).toEqual({
			role: 'member',
			apiPlan: 'member',
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
			apiPlan: 'viewer',
			ppiAccess: true
		});
	});

	it('returns without writing when resolved entitlements are unchanged', async () => {
		const mock = createRecomputeMock({
			roleReads: [{ role: 'viewer', api_plan: 'viewer', ppi_access: false }]
		});

		const result = await recomputeUserBillingEntitlements(mock.supabase, 'user_123');

		expect(result.changed).toBe(false);
		expect(mock.updates).toEqual([]);
	});

	it('updates changed entitlements with null-safe predicates for every originally read value', async () => {
		const mock = createRecomputeMock({
			roleReads: [{ role: 'viewer', api_plan: null, ppi_access: null }],
			casResults: ['success']
		});

		const result = await recomputeUserBillingEntitlements(mock.supabase, 'user_123');

		expect(result.changed).toBe(true);
		expect(result.resolvedEntitlements).toEqual({
			role: 'viewer',
			apiPlan: 'viewer',
			ppiAccess: false
		});
		expect(mock.updates).toEqual([
			{
				role: 'viewer',
				api_plan: 'viewer',
				ppi_access: false,
				updated_at: expect.any(String)
			}
		]);
		expect(mock.predicates).toEqual([
			[
				{ method: 'eq', column: 'id', value: 'user_123' },
				{ method: 'eq', column: 'role', value: 'viewer' },
				{ method: 'is', column: 'api_plan', value: null },
				{ method: 'is', column: 'ppi_access', value: null }
			]
		]);
	});

	it('fails closed without reading subscriptions or writing when user_roles authority is absent', async () => {
		const mock = createRecomputeMock({ roleReads: [null] });

		await expect(recomputeUserBillingEntitlements(mock.supabase, 'user_123')).rejects.toMatchObject(
			{
				name: 'BillingAuthorityMissingError',
				userId: 'user_123',
				phase: 'read'
			}
		);

		expect(mock.from).toHaveBeenCalledTimes(1);
		expect(mock.updates).toEqual([]);
	});

	it('fails closed when user_roles authority disappears between read and update', async () => {
		const mock = createRecomputeMock({
			roleReads: [{ role: 'viewer', api_plan: 'viewer', ppi_access: false }],
			casResults: ['conflict'],
			authorityChecks: [false],
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				}
			]
		});

		await expect(recomputeUserBillingEntitlements(mock.supabase, 'user_123')).rejects.toMatchObject(
			{
				name: 'BillingAuthorityMissingError',
				userId: 'user_123',
				phase: 'update'
			}
		);

		expect(mock.updates).toHaveLength(1);
	});

	it('retries one conflict and preserves a concurrent explicit API grant', async () => {
		const mock = createRecomputeMock({
			roleReads: [
				{ role: 'viewer', api_plan: 'viewer', ppi_access: false },
				{ role: 'viewer', api_plan: 'enterprise', ppi_access: false }
			],
			casResults: ['conflict', 'success'],
			authorityChecks: [true],
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				}
			]
		});

		const result = await recomputeUserBillingEntitlements(mock.supabase, 'user_123');

		expect(result.resolvedEntitlements).toEqual({
			role: 'member',
			apiPlan: 'enterprise',
			ppiAccess: false
		});
		expect(mock.updates).toHaveLength(2);
		expect(mock.updates[1]).toMatchObject({
			role: 'member',
			api_plan: 'enterprise',
			ppi_access: false
		});
		expect(mock.predicates[1]).toContainEqual({
			method: 'eq',
			column: 'api_plan',
			value: 'enterprise'
		});
	});

	it('terminates with a typed retryable conflict after repeated concurrent updates', async () => {
		const row = { role: 'viewer', api_plan: 'viewer', ppi_access: false } as const;
		const mock = createRecomputeMock({
			roleReads: [row, row, row],
			casResults: ['conflict', 'conflict', 'conflict'],
			authorityChecks: [true, true, true],
			subscriptions: [
				{
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active'
				}
			]
		});

		await expect(recomputeUserBillingEntitlements(mock.supabase, 'user_123')).rejects.toMatchObject(
			{
				name: 'BillingEntitlementConflictError',
				userId: 'user_123',
				attempts: 3,
				retryable: true
			}
		);
		expect(mock.updates).toHaveLength(3);
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
