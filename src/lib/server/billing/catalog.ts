import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';

export interface BillingCatalogEntry {
	purchaseKey: BillingPurchaseKey;
	productFamily: 'membership';
	stripePriceId: string;
	planName: string;
	interval: 'month' | 'year';
}

const BILLING_CATALOG: Record<BillingPurchaseKey, BillingCatalogEntry> = {
	[BILLING_PURCHASE_KEYS.membershipMonthly]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
		planName: 'Roaster Plan',
		interval: 'month'
	},
	[BILLING_PURCHASE_KEYS.membershipAnnual]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
		planName: 'Roaster Plan',
		interval: 'year'
	}
};

export function getBillingCatalogEntry(purchaseKey: string): BillingCatalogEntry | null {
	return BILLING_CATALOG[purchaseKey as BillingPurchaseKey] ?? null;
}

export function listBillingCatalogEntries(): BillingCatalogEntry[] {
	return Object.values(BILLING_CATALOG);
}
