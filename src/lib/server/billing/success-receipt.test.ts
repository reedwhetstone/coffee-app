import { describe, expect, it } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import { getBillingCatalogEntry } from './catalog';
import { buildBillingSuccessReceipt } from './success-receipt';

describe('buildBillingSuccessReceipt', () => {
	it('builds a Mallard Studio receipt with a workflow-oriented next action', () => {
		const receipt = buildBillingSuccessReceipt({
			catalogEntries: [getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipMonthly)!],
			entitlements: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: false
			}
		});

		expect(receipt.title).toBe('Mallard Studio is now active');
		expect(receipt.primaryAction).toEqual({
			href: '/dashboard',
			label: 'Open Mallard Studio',
			description: 'Jump back into your operator workflows and studio dashboard.'
		});
		expect(receipt.products).toEqual([
			expect.objectContaining({
				productName: 'Mallard Studio',
				planName: 'Mallard Studio Member',
				intervalLabel: 'Monthly'
			})
		]);
		expect(receipt.entitlementSummary[0]).toEqual(
			expect.objectContaining({ label: 'Mallard Studio', value: 'Active', tone: 'success' })
		);
		expect(receipt.entitlementSummary[1]).toEqual(
			expect.objectContaining({ label: 'Parchment API', value: 'Explorer baseline' })
		);
	});

	it('builds a Parchment API receipt with a console next action', () => {
		const receipt = buildBillingSuccessReceipt({
			catalogEntries: [getBillingCatalogEntry(BILLING_PURCHASE_KEYS.apiPlanMonthly)!],
			entitlements: {
				role: 'viewer',
				userRole: ['viewer'],
				apiPlan: 'member',
				ppiAccess: false
			}
		});

		expect(receipt.title).toBe('Parchment API is now active');
		expect(receipt.primaryAction.href).toBe('/api-dashboard');
		expect(receipt.primaryAction.label).toBe('Open Parchment Console');
		expect(receipt.entitlementSummary[1]).toEqual(
			expect.objectContaining({ value: 'Paid API active', tone: 'success' })
		);
	});

	it('uses the control plane as the primary action when multiple products were purchased together', () => {
		const receipt = buildBillingSuccessReceipt({
			catalogEntries: [
				getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipAnnual)!,
				getBillingCatalogEntry(BILLING_PURCHASE_KEYS.ppiAddonMonthly)!
			],
			entitlements: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: true
			}
		});

		expect(receipt.title).toBe('Your product access has been reconciled');
		expect(receipt.summary).toContain('Mallard Studio and Parchment Intelligence');
		expect(receipt.primaryAction).toEqual({
			href: '/subscription',
			label: 'Review subscription control plane',
			description: 'See every product family and the latest reconciled billing state in one place.'
		});
		expect(receipt.secondaryActions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ href: '/dashboard', label: 'Open Mallard Studio' }),
				expect.objectContaining({ href: '/analytics', label: 'View analytics' })
			])
		);
	});
});
