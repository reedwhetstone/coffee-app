import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';
import type { UserRole } from '$lib/types/auth.types';
import type { Database } from '$lib/types/database.types';

export type BillingProductFamily = 'membership' | 'api_plan' | 'ppi_addon';
export type BillingInterval = 'month' | 'year' | 'default' | 'custom';
export type BillingCatalogBillingKind = 'stripe' | 'default' | 'contact_sales';

export interface BillingCatalogGrants {
	role?: Extract<UserRole, 'member'>;
	apiPlan?: Database['public']['Tables']['user_roles']['Row']['api_plan'];
	ppiAccess?: boolean;
}

export interface BillingCatalogEntry {
	purchaseKey: BillingPurchaseKey;
	productFamily: BillingProductFamily;
	stripePriceId: string | null;
	planName: string;
	displayName: string;
	publicProductName: string;
	publicPlanName: string;
	interval: BillingInterval;
	billingKind: BillingCatalogBillingKind;
	selfServe: boolean;
	isDefaultFreeTier: boolean;
	showOnSubscription: boolean;
	ctaLabel: string | null;
	grants: BillingCatalogGrants;
}

const BILLING_CATALOG: Record<BillingPurchaseKey, BillingCatalogEntry> = {
	[BILLING_PURCHASE_KEYS.membershipMonthly]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
		planName: 'Mallard Studio Member',
		displayName: 'Mallard Studio monthly',
		publicProductName: 'Mallard Studio',
		publicPlanName: 'Mallard Studio Member',
		interval: 'month',
		billingKind: 'stripe',
		selfServe: true,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Unlock Mallard Studio',
		grants: {
			role: 'member'
		}
	},
	[BILLING_PURCHASE_KEYS.membershipAnnual]: {
		purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
		productFamily: 'membership',
		stripePriceId: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
		planName: 'Mallard Studio Member',
		displayName: 'Mallard Studio annual',
		publicProductName: 'Mallard Studio',
		publicPlanName: 'Mallard Studio Member',
		interval: 'year',
		billingKind: 'stripe',
		selfServe: true,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Unlock Mallard Studio',
		grants: {
			role: 'member'
		}
	},
	[BILLING_PURCHASE_KEYS.apiPlanExplorer]: {
		purchaseKey: BILLING_PURCHASE_KEYS.apiPlanExplorer,
		productFamily: 'api_plan',
		stripePriceId: null,
		planName: 'Green',
		displayName: 'Green',
		publicProductName: 'Parchment API',
		publicPlanName: 'Green',
		interval: 'default',
		billingKind: 'default',
		selfServe: false,
		isDefaultFreeTier: true,
		showOnSubscription: true,
		ctaLabel: 'Start with Green',
		grants: {
			apiPlan: 'viewer'
		}
	},
	[BILLING_PURCHASE_KEYS.apiPlanMonthly]: {
		purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
		productFamily: 'api_plan',
		stripePriceId: 'price_1TLTecKwI9NkGqAn07hkozWj',
		planName: 'Origin',
		displayName: 'Origin monthly',
		publicProductName: 'Parchment API',
		publicPlanName: 'Origin',
		interval: 'month',
		billingKind: 'stripe',
		selfServe: true,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Upgrade to Origin',
		grants: {
			apiPlan: 'member'
		}
	},
	[BILLING_PURCHASE_KEYS.apiPlanEnterprise]: {
		purchaseKey: BILLING_PURCHASE_KEYS.apiPlanEnterprise,
		productFamily: 'api_plan',
		stripePriceId: null,
		planName: 'Enterprise',
		displayName: 'Parchment API enterprise',
		publicProductName: 'Parchment API',
		publicPlanName: 'Enterprise',
		interval: 'custom',
		billingKind: 'contact_sales',
		selfServe: false,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Talk to us',
		grants: {
			apiPlan: 'enterprise'
		}
	},
	[BILLING_PURCHASE_KEYS.ppiAddonMonthly]: {
		purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
		productFamily: 'ppi_addon',
		stripePriceId: 'price_1TLTgHKwI9NkGqAnlhWTVkqp',
		planName: 'Parchment Intelligence',
		displayName: 'Parchment Intelligence monthly',
		publicProductName: 'Parchment Intelligence',
		publicPlanName: 'Parchment Intelligence',
		interval: 'month',
		billingKind: 'stripe',
		selfServe: true,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Unlock Parchment Intelligence',
		grants: {
			ppiAccess: true
		}
	},
	[BILLING_PURCHASE_KEYS.ppiAddonAnnual]: {
		purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonAnnual,
		productFamily: 'ppi_addon',
		stripePriceId: 'price_1TLTihKwI9NkGqAnxqhgpLN1',
		planName: 'Parchment Intelligence',
		displayName: 'Parchment Intelligence annual',
		publicProductName: 'Parchment Intelligence',
		publicPlanName: 'Parchment Intelligence',
		interval: 'year',
		billingKind: 'stripe',
		selfServe: true,
		isDefaultFreeTier: false,
		showOnSubscription: true,
		ctaLabel: 'Unlock Parchment Intelligence',
		grants: {
			ppiAccess: true
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
