export const BILLING_PURCHASE_KEYS = {
	membershipMonthly: 'membership.monthly',
	membershipAnnual: 'membership.annual'
} as const;

export type BillingPurchaseKey = (typeof BILLING_PURCHASE_KEYS)[keyof typeof BILLING_PURCHASE_KEYS];
