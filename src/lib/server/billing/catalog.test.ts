import { describe, expect, it } from 'vitest';

import { BILLING_PURCHASE_KEYS } from '$lib/billing/purchaseKeys';

import { getBillingCatalogEntry, listBillingCatalogEntries } from './catalog';

describe('billing catalog', () => {
	it('maps membership purchase keys to allowlisted Stripe prices', () => {
		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipMonthly)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
			productFamily: 'membership',
			stripePriceId: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
			interval: 'month'
		});

		expect(getBillingCatalogEntry(BILLING_PURCHASE_KEYS.membershipAnnual)).toMatchObject({
			purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
			productFamily: 'membership',
			stripePriceId: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
			interval: 'year'
		});
	});

	it('returns null for unknown purchase keys', () => {
		expect(getBillingCatalogEntry('membership.lifetime')).toBeNull();
	});

	it('exposes the current catalog entries for server-side allowlisting', () => {
		expect(listBillingCatalogEntries()).toHaveLength(2);
	});
});
