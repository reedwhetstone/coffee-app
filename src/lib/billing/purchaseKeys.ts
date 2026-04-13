export const BILLING_PURCHASE_KEYS = {
	membershipMonthly: 'membership.monthly',
	membershipAnnual: 'membership.annual',
	apiPlanExplorer: 'api_plan.explorer',
	apiPlanMonthly: 'api_plan.monthly',
	apiPlanEnterprise: 'api_plan.enterprise',
	ppiAddonMonthly: 'ppi_addon.monthly',
	ppiAddonAnnual: 'ppi_addon.annual'
} as const;

export type BillingPurchaseKey = (typeof BILLING_PURCHASE_KEYS)[keyof typeof BILLING_PURCHASE_KEYS];
