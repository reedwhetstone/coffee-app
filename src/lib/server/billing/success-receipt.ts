import type { BillingCatalogEntry } from './catalog';
import type { ResolvedBillingEntitlements } from './entitlements';

export interface BillingSuccessReceiptAction {
	href: string;
	label: string;
	description: string;
}

export interface BillingSuccessReceiptProduct {
	purchaseKey: BillingCatalogEntry['purchaseKey'];
	productFamily: BillingCatalogEntry['productFamily'];
	productName: BillingCatalogEntry['publicProductName'];
	planName: BillingCatalogEntry['publicPlanName'];
	intervalLabel: string;
	summary: string;
	nextAction: BillingSuccessReceiptAction;
}

export interface BillingSuccessReceiptEntitlement {
	label: 'Mallard Studio' | 'Parchment API' | 'Parchment Intelligence';
	value: string;
	detail: string;
	tone: 'success' | 'muted' | 'info';
}

export interface BillingSuccessReceipt {
	title: string;
	summary: string;
	products: BillingSuccessReceiptProduct[];
	primaryAction: BillingSuccessReceiptAction;
	secondaryActions: BillingSuccessReceiptAction[];
	entitlementSummary: BillingSuccessReceiptEntitlement[];
}

const SUBSCRIPTION_CONTROL_PLANE_ACTION: BillingSuccessReceiptAction = {
	href: '/subscription',
	label: 'Review subscription control plane',
	description: 'See every product family and the latest reconciled billing state in one place.'
};

function toIntervalLabel(entry: BillingCatalogEntry): string {
	switch (entry.interval) {
		case 'month':
			return 'Monthly';
		case 'year':
			return 'Annual';
		case 'default':
			return 'Default tier';
		case 'custom':
			return 'Custom';
		default:
			return 'Billing plan';
	}
}

function buildProductSummary(entry: BillingCatalogEntry): string {
	switch (entry.productFamily) {
		case 'membership':
			return 'Paid Mallard Studio workflows are now attached to this account for roasting, inventory, tasting, profit, chat, and CLI-backed operator work.';
		case 'api_plan':
			return 'Production-ready Parchment API access is now attached to this account for apps, agents, and internal tools.';
		case 'ppi_addon':
			return 'The full Parchment Intelligence analytics and market-intelligence layer is now attached to this account.';
	}
}

function buildNextAction(entry: BillingCatalogEntry): BillingSuccessReceiptAction {
	switch (entry.productFamily) {
		case 'membership':
			return {
				href: '/dashboard',
				label: 'Open Mallard Studio',
				description: 'Jump back into your operator workflows and studio dashboard.'
			};
		case 'api_plan':
			return {
				href: '/api-dashboard',
				label: 'Open Parchment Console',
				description: 'Manage keys, docs, usage, and the paid API workspace.'
			};
		case 'ppi_addon':
			return {
				href: '/analytics',
				label: 'View analytics',
				description: 'Go straight to the full analytics and market-intelligence surface.'
			};
	}
}

function dedupeCatalogEntries(entries: BillingCatalogEntry[]): BillingCatalogEntry[] {
	const seen = new Set<string>();

	return entries.filter((entry) => {
		if (seen.has(entry.purchaseKey)) {
			return false;
		}

		seen.add(entry.purchaseKey);
		return true;
	});
}

function dedupeActions(actions: BillingSuccessReceiptAction[]): BillingSuccessReceiptAction[] {
	const seen = new Set<string>();

	return actions.filter((action) => {
		const key = `${action.href}:${action.label}`;
		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

function joinProductNames(names: string[]): string {
	if (names.length === 0) {
		return 'your purchase';
	}

	if (names.length === 1) {
		return names[0];
	}

	if (names.length === 2) {
		return `${names[0]} and ${names[1]}`;
	}

	return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function buildEntitlementSummary(
	entitlements: ResolvedBillingEntitlements | null
): BillingSuccessReceiptEntitlement[] {
	const resolved = entitlements ?? {
		role: 'viewer',
		userRole: ['viewer'],
		apiPlan: 'viewer',
		ppiAccess: false
	};

	return [
		resolved.role === 'admin'
			? {
					label: 'Mallard Studio',
					value: 'Admin access',
					detail: 'Admin privileges keep the full studio surface available on this account.',
					tone: 'info'
				}
			: resolved.role === 'member'
				? {
						label: 'Mallard Studio',
						value: 'Active',
						detail: 'The paid workflow layer is active for this account.',
						tone: 'success'
					}
				: {
						label: 'Mallard Studio',
						value: 'Viewer baseline',
						detail: 'This account is still on the free Mallard Studio baseline.',
						tone: 'muted'
					},
		resolved.apiPlan === 'enterprise'
			? {
					label: 'Parchment API',
					value: 'Enterprise access',
					detail: 'Enterprise-grade API access is active for this account.',
					tone: 'info'
				}
			: resolved.apiPlan === 'member'
				? {
						label: 'Parchment API',
						value: 'Paid API active',
						detail: 'The paid API plan is active for this account.',
						tone: 'success'
					}
				: {
						label: 'Parchment API',
						value: 'Explorer baseline',
						detail: 'This account still resolves to the free Explorer API tier.',
						tone: 'muted'
					},
		resolved.ppiAccess
			? {
					label: 'Parchment Intelligence',
					value: 'Unlocked',
					detail: 'The full analytics and market-intelligence layer is active.',
					tone: 'success'
				}
			: {
					label: 'Parchment Intelligence',
					value: 'Locked',
					detail: 'This account still has only the limited free analytics floor.',
					tone: 'muted'
				}
	];
}

export function buildBillingSuccessReceipt(input: {
	catalogEntries: BillingCatalogEntry[];
	entitlements: ResolvedBillingEntitlements | null;
}): BillingSuccessReceipt {
	const catalogEntries = dedupeCatalogEntries(input.catalogEntries);
	const products = catalogEntries.map((entry) => ({
		purchaseKey: entry.purchaseKey,
		productFamily: entry.productFamily,
		productName: entry.publicProductName,
		planName: entry.publicPlanName,
		intervalLabel: toIntervalLabel(entry),
		summary: buildProductSummary(entry),
		nextAction: buildNextAction(entry)
	}));

	const title =
		products.length === 1
			? `${products[0].productName} is now active`
			: products.length > 1
				? 'Your product access has been reconciled'
				: 'Purchase confirmed';

	const summary =
		products.length === 1
			? `${products[0].productName} has been reconciled from your Stripe checkout. The final entitlement state below reflects the live product access now attached to this account.`
			: products.length > 1
				? `This checkout included ${joinProductNames(products.map((product) => product.productName))}. The final entitlement state below reflects the reconciled product access now attached to this account.`
				: 'Your checkout completed successfully. The final entitlement state below reflects the latest reconciled billing result for this account.';

	const productActions = dedupeActions(products.map((product) => product.nextAction));
	const primaryAction =
		products.length === 1 && productActions[0]
			? productActions[0]
			: SUBSCRIPTION_CONTROL_PLANE_ACTION;
	const secondaryActions = dedupeActions(
		products.length === 1
			? [SUBSCRIPTION_CONTROL_PLANE_ACTION]
			: [...productActions, SUBSCRIPTION_CONTROL_PLANE_ACTION]
	).filter(
		(action) => !(action.href === primaryAction.href && action.label === primaryAction.label)
	);

	return {
		title,
		summary,
		products,
		primaryAction,
		secondaryActions,
		entitlementSummary: buildEntitlementSummary(input.entitlements)
	};
}
