import { describe, expect, it, vi } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import {
	buildBillingEntitlementDiscrepancyReport,
	repairBillingEntitlementDiscrepancy
} from './admin-discrepancies';

describe('billing entitlement admin discrepancies', () => {
	it('detects entitlement drift from billing snapshots and compatibility-mirror mismatches', () => {
		const report = buildBillingEntitlementDiscrepancyReport({
			userRoles: [
				{
					id: 'user_123',
					email: 'member@example.com',
					name: 'Member Drift',
					role: 'viewer',
					user_role: ['viewer', 'ppi-member'],
					api_plan: null as never,
					ppi_access: null as never,
					updated_at: '2026-04-12T00:00:00.000Z'
				}
			],
			stripeCustomers: [
				{
					user_id: 'user_123',
					customer_id: 'cus_123',
					email: 'member@example.com'
				}
			],
			billingSubscriptions: [
				{
					id: 'billing_sub_123',
					user_id: 'user_123',
					stripe_customer_id: 'cus_123',
					stripe_subscription_id: 'sub_123',
					stripe_subscription_item_id: 'si_123',
					stripe_price_id: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
					product_family: 'membership',
					product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
					status: 'active',
					current_period_end: '2026-05-12T00:00:00.000Z',
					cancel_at_period_end: false,
					metadata: {},
					created_at: '2026-04-12T00:00:00.000Z',
					updated_at: '2026-04-12T00:00:00.000Z'
				}
			],
			recentAuditLogs: [],
			lastChecked: '2026-04-12T13:00:00.000Z'
		});

		expect(report.summary.totalDiscrepancies).toBe(1);
		expect(report.summary.totalTrackedUsers).toBe(1);
		expect(report.discrepancies[0]).toMatchObject({
			userId: 'user_123',
			stripeCustomerId: 'cus_123',
			actual: {
				role: 'viewer',
				userRole: ['viewer', 'ppi-member'],
				apiPlan: null,
				ppiAccess: null
			},
			expected: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: false
			},
			issueFields: ['role', 'user_role', 'api_plan', 'ppi_access']
		});
		expect(report.discrepancies[0].billingSubscriptions).toHaveLength(1);
	});

	it('repairs a discrepancy by delegating to shared recompute logic and logging the audit event', async () => {
		const insert = vi.fn(async () => ({ error: null }));
		const upsert = vi.fn(async () => ({ error: null }));
		const maybeSingle = vi.fn(async () => ({
			data: {
				role: 'viewer',
				user_role: ['viewer', 'ppi-member'],
				api_plan: null as never,
				ppi_access: null as never
			},
			error: null
		}));
		const eqUserRoles = vi.fn(() => ({ maybeSingle }));
		const selectUserRoles = vi.fn(() => ({ eq: eqUserRoles }));
		const selectBillingSubscriptions = vi.fn(() => ({
			eq: vi.fn(async () => ({
				data: [
					{
						id: 'billing_sub_123',
						user_id: 'user_123',
						stripe_customer_id: 'cus_123',
						stripe_subscription_id: 'sub_123',
						stripe_subscription_item_id: 'si_123',
						stripe_price_id: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
						product_family: 'membership',
						product_key: BILLING_PURCHASE_KEYS.membershipMonthly,
						status: 'active',
						current_period_end: '2026-05-12T00:00:00.000Z',
						cancel_at_period_end: false,
						metadata: {},
						created_at: '2026-04-12T00:00:00.000Z',
						updated_at: '2026-04-12T00:00:00.000Z'
					}
				],
				error: null
			}))
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

			if (table === 'role_audit_logs') {
				return {
					insert
				};
			}

			throw new Error(`Unexpected table lookup: ${table}`);
		});

		const result = await repairBillingEntitlementDiscrepancy({ from } as never, {
			userId: 'user_123',
			adminUserId: 'admin_123',
			reason: 'Test repair'
		});

		expect(result.changed).toBe(true);
		expect(result.resolvedEntitlements).toEqual({
			role: 'member',
			userRole: ['member'],
			apiPlan: 'viewer',
			ppiAccess: false
		});
		expect(upsert).toHaveBeenCalledWith(
			{
				id: 'user_123',
				role: 'member',
				user_role: ['member'],
				api_plan: 'viewer',
				ppi_access: false,
				updated_at: expect.any(String)
			},
			{ onConflict: 'id' }
		);
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: 'user_123',
				old_role: 'viewer,ppi-member',
				new_role: 'member',
				trigger_type: 'admin_change',
				metadata: expect.objectContaining({
					reason: 'Test repair',
					admin_user: 'admin_123',
					changed: true
				}),
				created_at: expect.any(String)
			})
		);
	});
});
