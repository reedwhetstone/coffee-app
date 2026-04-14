import { describe, expect, it } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import {
	getBillingCatalogEntry,
	getBillingCatalogEntryByStripePriceId,
	listBillingCatalogEntries
} from './catalog';

describe('billing catalog', () => {
	it('maps launched self-serve purchase keys to allowlisted Stripe prices', () => {
		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipMonthly)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
			productFamily: 'membership',
			stripePriceId: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
			publicProductName: 'Mallard Studio',
			interval: 'month',
			selfServe: true
		});

		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipAnnual)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
			productFamily: 'membership',
			stripePriceId: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
			publicProductName: 'Mallard Studio',
			interval: 'year',
			selfServe: true
		});

		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.apiPlanMonthly)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
			productFamily: 'api_plan',
			stripePriceId: 'price_1TLTecKwI9NkGqAn07hkozWj',
			publicProductName: 'Parchment API',
			interval: 'month',
			selfServe: true,
			grants: {
				apiPlan: 'member'
			}
		});

		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.ppiAddonMonthly)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
			productFamily: 'ppi_addon',
			stripePriceId: 'price_1TLTgHKwI9NkGqAnlhWTVkqp',
			publicProductName: 'Parchment Intelligence',
			interval: 'month',
			selfServe: true,
			grants: {
				ppiAccess: true
			}
		});

		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.ppiAddonAnnual)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonAnnual,
			productFamily: 'ppi_addon',
			stripePriceId: 'price_1TLTihKwI9NkGqAnxqhgpLN1',
			publicProductName: 'Parchment Intelligence',
			interval: 'year',
			selfServe: true,
			grants: {
				ppiAccess: true
			}
		});
	});

	it('keeps Green as the non-Stripe default API tier', () => {
		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.apiPlanExplorer)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.apiPlanExplorer,
			productFamily: 'api_plan',
			stripePriceId: null,
			billingKind: 'default',
			selfServe: false,
			isDefaultFreeTier: true,
			publicPlanName: 'Green',
			grants: {
				apiPlan: 'viewer'
			}
		});
	});

	it('models enterprise as contact-sales only, not a self-serve Stripe SKU', () => {
		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.apiPlanEnterprise)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.apiPlanEnterprise,
			productFamily: 'api_plan',
			stripePriceId: null,
			billingKind: 'contact_sales',
			selfServe: false,
			publicPlanName: 'Enterprise',
			grants: {
				apiPlan: 'enterprise'
			}
		});
	});

	it('returns null for unknown purchase keys', () => {
		expect(getBillingCatalogEntry('membership.lifetime')).toBeNull();
	});

	it('maps allowlisted Stripe price IDs back to catalog entries for reconciliation', () => {
		expect(getBillingCatalogEntryByStripePriceId('price_1RgGYuKwI9NkGqAnm4oiHpbx')).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
			grants: {
				role: 'member'
			}
		});
		expect(getBillingCatalogEntryByStripePriceId('price_1TLTecKwI9NkGqAn07hkozWj')).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
			grants: {
				apiPlan: 'member'
			}
		});
		expect(getBillingCatalogEntryByStripePriceId('price_missing')).toBeNull();
	});

	it('exposes the current catalog entries for server-side allowlisting and UI metadata', () => {
		expect(listBillingCatalogEntries()).toHaveLength(7);
	});
});
