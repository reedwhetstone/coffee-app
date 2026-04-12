import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';
import type { UserRole } from '$lib/types/auth.types';
import type { Database } from '$lib/types/database.types';

export type BillingProductFamily = 'membership' | 'api_plan' | 'ppi_addon';

export interface BillingCatalogGrants {
	role?: Extract<UserRole, 'member'>;
	apiPlan?: Database['public']['Tables']['user_roles']['Row']['api_plan'];
	ppiAccess?: boolean;
}

export interface BillingCatalogEntry {
	purchaseKey: BillingPurchaseKey;
	productFamily: BillingProductFamily;
	stripePriceId: string;
	planName: string;
	interval: 'month' | 'year';
	grants: BillingCatalogGrants;
}

const BILLING_CATALOG: Record<BillingPurchaseKey, BillingCatalogEntry> = {
	[BILLING_PURCHASE_KEYS.membershipMonthly]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
		planName: 'Roaster Plan',
		interval: 'month',
		grants: {
			role: 'member'
		}
	},
	[BILLING_PURCHASE_KEYS.membershipAnnual]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
		planName: 'Roaster Plan',
		interval: 'year',
		grants: {
			role: 'member'
		}
	}
};

export function getBillingCatalogEntry(purchaseKey: string): BillingCatalogEntry | null {
	return BILLING_CATALOG[purchaseKey as BillingPurchaseKey] ?? null;
}

export function getBillingCatalogEntryByStripePriceId(
	stripePriceId: string
): BillingCatalogEntry | null {
	return (
		Object.values(BILLING_CATALOG).find((entry) => entry.stripePriceId === stripePriceId) ?? null
	);
}

export function listBillingCatalogEntries(): BillingCatalogEntry[] {
	return Object.values(BILLING_CATALOG);
}
