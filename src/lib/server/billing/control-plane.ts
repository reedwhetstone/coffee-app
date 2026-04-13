import type { SubscriptionDetails } from '$lib/services/stripe';
import { isBillingSubscriptionActive } from '$lib/server/billing/entitlements';
import {
	getBillingCatalogEntry,
	listBillingCatalogEntries,
	type BillingCatalogEntry
} from '$lib/server/billing/catalog';
import { resolveMembershipSubscriptionManagementState } from '$lib/server/billing/subscription-management';
import type { UserRole } from '$lib/types/auth.types';
import type { Database } from '$lib/types/database.types';

type ApiPlan = Database['public']['Tables']['user_roles']['Row']['api_plan'];

type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

type BillingSubscriptionSnapshot = Pick<
	BillingSubscriptionRow,
	| 'stripe_subscription_id'
	| 'product_family'
	| 'product_key'
	| 'status'
	| 'cancel_at_period_end'
	| 'current_period_end'
>;

type ControlPlaneTone = 'success' | 'info' | 'warning' | 'muted';

type ControlPlanePeriodEnd = number | string | null;

const CURRENT_OWNERSHIP_STATUSES = new Set(['active', 'trialing']);

const OPERATIONAL_BILLING_STATUSES = new Set([
	'active',
	'trialing',
	'past_due',
	'incomplete',
	'unpaid'
]);

export interface ControlPlanePlanOption {
	purchaseKey: BillingCatalogEntry['purchaseKey'];
	planName: string;
	priceLabel: string;
	intervalLabel: string;
	badge: string | null;
	ctaLabel: string;
}

interface ControlPlaneCurrentPlan {
	name: string;
	priceLabel: string | null;
	intervalLabel: string | null;
	currentPeriodEnd: ControlPlanePeriodEnd;
	cancelAtPeriodEnd: boolean;
	stripeStatus: SubscriptionDetails['status'] | null;
	subscriptionId: string | null;
}

interface ProductFamilySectionBase {
	statusLabel: string;
	tone: ControlPlaneTone;
	description: string;
	sourceLabel: string;
	currentPlan: ControlPlaneCurrentPlan | null;
}

export interface SubscriptionControlPlaneState {
	membership: ProductFamilySectionBase & {
		hasAccess: boolean;
		canManageSubscription: boolean;
		managementBlockedReason: string | null;
		availablePlans: ControlPlanePlanOption[];
	};
	api: ProductFamilySectionBase & {
		plan: ApiPlan;
		resolvedPlanName: string;
		hasPaidPlan: boolean;
		upgradePlans: ControlPlanePlanOption[];
		consoleHref: string;
	};
	intelligence: ProductFamilySectionBase & {
		enabled: boolean;
		availablePlans: ControlPlanePlanOption[];
	};
	enterprise: {
		statusLabel: string;
		tone: ControlPlaneTone;
		description: string;
		note: string;
		contactHref: string;
	};
}

function getCatalogPriceLabel(entry: BillingCatalogEntry): string {
	switch (entry.purchaseKey) {
		case 'membership.monthly':
			return '$9/month';
		case 'membership.annual':
			return '$80/year';
		case 'api_plan.explorer':
			return 'Free';
		case 'api_plan.monthly':
			return '$99/month';
		case 'ppi_addon.monthly':
			return '$39/month';
		case 'ppi_addon.annual':
			return '$350/year';
		default:
			return entry.publicPlanName;
	}
}

function getIntervalLabel(entry: BillingCatalogEntry): string {
	switch (entry.interval) {
		case 'month':
			return 'Monthly';
		case 'year':
			return 'Annual';
		case 'default':
			return 'Included';
		default:
			return 'Custom';
	}
}

function formatStripePriceLabel(plan: SubscriptionDetails['plan'] | undefined): string | null {
	if (!plan?.amount || !plan.interval) {
		return null;
	}

	return `$${plan.amount / 100}/${plan.interval}`;
}

function buildPlanOption(entry: BillingCatalogEntry): ControlPlanePlanOption {
	return {
		purchaseKey: entry.purchaseKey,
		planName: entry.publicPlanName,
		priceLabel: getCatalogPriceLabel(entry),
		intervalLabel: getIntervalLabel(entry),
		badge:
			entry.purchaseKey === 'membership.annual'
				? 'Save $28/year'
				: entry.purchaseKey === 'ppi_addon.annual'
					? 'Best value'
					: null,
		ctaLabel: entry.ctaLabel ?? `Choose ${entry.publicPlanName}`
	};
}

function buildAvailablePlans(
	family: BillingCatalogEntry['productFamily']
): ControlPlanePlanOption[] {
	const intervalOrder: Record<BillingCatalogEntry['interval'], number> = {
		default: 0,
		month: 1,
		year: 2,
		custom: 3
	};

	return listBillingCatalogEntries()
		.filter(
			(entry) =>
				entry.productFamily === family &&
				entry.showOnSubscription &&
				entry.selfServe &&
				entry.billingKind === 'stripe'
		)
		.sort((a, b) => intervalOrder[a.interval] - intervalOrder[b.interval])
		.map((entry) => buildPlanOption(entry));
}

function hasCurrentOwnershipStatus(status: string | null | undefined): boolean {
	return Boolean(status && CURRENT_OWNERSHIP_STATUSES.has(status));
}

function hasCurrentStripeOwnership(subscription: SubscriptionDetails | null): boolean {
	return Boolean(subscription && hasCurrentOwnershipStatus(subscription.status));
}

function hasOperationalBillingStatus(status: string | null | undefined): boolean {
	return Boolean(status && OPERATIONAL_BILLING_STATUSES.has(status));
}

function getRelevantFamilySnapshot(
	subscriptions: BillingSubscriptionSnapshot[],
	family: BillingCatalogEntry['productFamily']
): BillingSubscriptionSnapshot | null {
	const matching = subscriptions.filter(
		(subscription) =>
			subscription.product_family === family && hasCurrentOwnershipStatus(subscription.status)
	);
	if (matching.length === 0) {
		return null;
	}

	const ranked = [...matching].sort((a, b) => {
		const aActive = isBillingSubscriptionActive(a.status) ? 1 : 0;
		const bActive = isBillingSubscriptionActive(b.status) ? 1 : 0;
		if (aActive !== bActive) {
			return bActive - aActive;
		}

		const aTime = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
		const bTime = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
		return bTime - aTime;
	});

	return ranked[0] ?? null;
}

function buildCurrentPlan(input: {
	stripeSubscription: SubscriptionDetails | null;
	snapshot: BillingSubscriptionSnapshot | null;
	fallbackEntry: BillingCatalogEntry | null;
}): ControlPlaneCurrentPlan | null {
	const stripeSubscription = hasCurrentOwnershipStatus(input.stripeSubscription?.status)
		? input.stripeSubscription
		: null;
	const { snapshot, fallbackEntry } = input;
	if (!stripeSubscription && !snapshot && !fallbackEntry) {
		return null;
	}

	return {
		name:
			stripeSubscription?.plan?.name ||
			fallbackEntry?.publicPlanName ||
			fallbackEntry?.planName ||
			'Plan',
		priceLabel:
			formatStripePriceLabel(stripeSubscription?.plan) ||
			(fallbackEntry ? getCatalogPriceLabel(fallbackEntry) : null),
		intervalLabel: stripeSubscription?.plan?.interval
			? stripeSubscription.plan.interval === 'year'
				? 'Annual'
				: 'Monthly'
			: fallbackEntry
				? getIntervalLabel(fallbackEntry)
				: null,
		currentPeriodEnd:
			stripeSubscription?.current_period_end ?? snapshot?.current_period_end ?? null,
		cancelAtPeriodEnd:
			stripeSubscription?.cancel_at_period_end ?? snapshot?.cancel_at_period_end ?? false,
		stripeStatus: stripeSubscription?.status ?? null,
		subscriptionId: stripeSubscription?.id ?? snapshot?.stripe_subscription_id ?? null
	};
}

function buildMembershipSourceLabel(input: {
	role: UserRole;
	hasActiveMembershipSnapshot: boolean;
	hasActiveStripeSubscription: boolean;
	stripeSubscription: SubscriptionDetails | null;
}): string {
	if (input.role === 'admin') {
		return 'Admin access is preserved independently of Stripe billing.';
	}

	if (
		(input.hasActiveMembershipSnapshot || input.hasActiveStripeSubscription) &&
		input.stripeSubscription?.cancel_at_period_end
	) {
		return 'Backed by a Mallard Studio Stripe subscription that is set to cancel at period end.';
	}

	if (input.hasActiveMembershipSnapshot || input.hasActiveStripeSubscription) {
		return 'Backed by your reconciled Mallard Studio billing state.';
	}

	if (input.role === 'member') {
		return 'No current Mallard Studio billing state is attached, so this page falls back to the free viewer baseline until billing sync shows an active membership.';
	}

	return 'You are currently on the free viewer baseline for Mallard Studio.';
}

function buildApiSourceLabel(input: {
	apiPlan: ApiPlan;
	hasActiveApiSnapshot: boolean;
	hasActiveStripeSubscription: boolean;
	stripeSubscription: SubscriptionDetails | null;
}): string {
	if (input.apiPlan === 'enterprise') {
		return 'Enterprise API access is sales-led and managed outside normal self-serve checkout.';
	}

	if (
		input.apiPlan === 'member' &&
		(input.hasActiveApiSnapshot || input.hasActiveStripeSubscription) &&
		input.stripeSubscription?.cancel_at_period_end
	) {
		return 'Backed by a paid Parchment API subscription that is set to cancel at period end.';
	}

	if (
		input.apiPlan === 'member' &&
		(input.hasActiveApiSnapshot || input.hasActiveStripeSubscription)
	) {
		return 'Backed by your paid Parchment API subscription.';
	}

	if (input.apiPlan === 'member') {
		return 'Resolved from stored API entitlements.';
	}

	return 'Explorer is your free API baseline and does not require a Stripe subscription.';
}

function buildIntelligenceSourceLabel(input: {
	ppiAccess: boolean;
	hasActiveSnapshot: boolean;
	hasActiveStripeSubscription: boolean;
	stripeSubscription: SubscriptionDetails | null;
}): string {
	if (
		input.ppiAccess &&
		(input.hasActiveSnapshot || input.hasActiveStripeSubscription) &&
		input.stripeSubscription?.cancel_at_period_end
	) {
		return 'Backed by a Parchment Intelligence subscription that is set to cancel at period end.';
	}

	if (input.ppiAccess && (input.hasActiveSnapshot || input.hasActiveStripeSubscription)) {
		return 'Backed by your Parchment Intelligence billing state.';
	}

	if (input.ppiAccess) {
		return 'Resolved from stored intelligence entitlements.';
	}

	return 'You still keep the limited free analytics floor until you unlock Parchment Intelligence.';
}

export function buildSubscriptionControlPlaneState(input: {
	role: UserRole;
	apiPlan: ApiPlan;
	ppiAccess: boolean;
	billingSubscriptions?: BillingSubscriptionSnapshot[] | null;
	stripeSubscriptions?: {
		membership?: SubscriptionDetails | null;
		api?: SubscriptionDetails | null;
		intelligence?: SubscriptionDetails | null;
	} | null;
}): SubscriptionControlPlaneState {
	const billingSubscriptions = input.billingSubscriptions ?? [];
	const membershipStripeSubscription = input.stripeSubscriptions?.membership ?? null;
	const apiStripeSubscription = input.stripeSubscriptions?.api ?? null;
	const intelligenceStripeSubscription = input.stripeSubscriptions?.intelligence ?? null;

	const membershipSnapshot = getRelevantFamilySnapshot(billingSubscriptions, 'membership');
	const apiSnapshot = getRelevantFamilySnapshot(billingSubscriptions, 'api_plan');
	const intelligenceSnapshot = getRelevantFamilySnapshot(billingSubscriptions, 'ppi_addon');

	const hasCurrentMembershipBillingState = Boolean(
		membershipSnapshot || hasCurrentStripeOwnership(membershipStripeSubscription)
	);
	const hasCurrentApiBillingState = Boolean(
		apiSnapshot || hasCurrentStripeOwnership(apiStripeSubscription)
	);
	const hasCurrentIntelligenceBillingState = Boolean(
		intelligenceSnapshot || hasCurrentStripeOwnership(intelligenceStripeSubscription)
	);

	const resolvedApiPlan: ApiPlan =
		input.apiPlan === 'enterprise'
			? 'enterprise'
			: input.apiPlan === 'member' || hasCurrentApiBillingState
				? 'member'
				: 'viewer';
	const resolvedPpiAccess = input.ppiAccess || hasCurrentIntelligenceBillingState;

	const membershipCatalogEntry = membershipSnapshot
		? getBillingCatalogEntry(membershipSnapshot.product_key)
		: null;
	const apiCatalogEntry = apiSnapshot ? getBillingCatalogEntry(apiSnapshot.product_key) : null;
	const intelligenceCatalogEntry = intelligenceSnapshot
		? getBillingCatalogEntry(intelligenceSnapshot.product_key)
		: null;

	const membershipManagementState = resolveMembershipSubscriptionManagementState({
		subscriptionId: membershipStripeSubscription?.id,
		billingSubscriptions: billingSubscriptions.filter((subscription) =>
			hasOperationalBillingStatus(subscription.status)
		)
	});
	const membershipHasAccess = input.role === 'admin' || hasCurrentMembershipBillingState;
	const membershipTone: ControlPlaneTone =
		input.role === 'admin'
			? 'info'
			: membershipHasAccess
				? membershipStripeSubscription?.cancel_at_period_end
					? 'warning'
					: 'success'
				: 'muted';

	const apiHasPaidPlan = resolvedApiPlan === 'member' || resolvedApiPlan === 'enterprise';
	const apiTone: ControlPlaneTone =
		resolvedApiPlan === 'enterprise' ? 'info' : resolvedApiPlan === 'member' ? 'success' : 'muted';

	const intelligenceTone: ControlPlaneTone = resolvedPpiAccess
		? intelligenceStripeSubscription?.cancel_at_period_end
			? 'warning'
			: 'success'
		: 'muted';

	return {
		membership: {
			hasAccess: membershipHasAccess,
			statusLabel:
				input.role === 'admin'
					? 'Admin access'
					: membershipHasAccess
						? membershipStripeSubscription?.cancel_at_period_end
							? 'Mallard Studio active, canceling at period end'
							: 'Mallard Studio active'
						: 'Viewer baseline',
			tone: membershipTone,
			description: membershipHasAccess
				? 'Mallard Studio gives you the paid workflow layer for roasting, inventory, tasting, profit visibility, chat, and CLI-backed operator workflows.'
				: 'Upgrade to Mallard Studio Member to unlock the full operator workflow surface for roasting, inventory, tasting, profit, chat, and CLI workflows.',
			sourceLabel: buildMembershipSourceLabel({
				role: input.role,
				hasActiveMembershipSnapshot: hasCurrentMembershipBillingState,
				hasActiveStripeSubscription: hasCurrentStripeOwnership(membershipStripeSubscription),
				stripeSubscription: membershipStripeSubscription
			}),
			currentPlan: buildCurrentPlan({
				stripeSubscription: membershipStripeSubscription,
				snapshot: membershipSnapshot,
				fallbackEntry: membershipCatalogEntry
			}),
			canManageSubscription:
				Boolean(membershipStripeSubscription?.id) && membershipManagementState.canManage,
			managementBlockedReason: membershipManagementState.hasBlockingOtherFamilies
				? 'Mallard Studio cancel and resume are unavailable here when that Stripe subscription also contains Parchment API or Parchment Intelligence products.'
				: null,
			availablePlans: buildAvailablePlans('membership')
		},
		api: {
			plan: resolvedApiPlan,
			resolvedPlanName:
				resolvedApiPlan === 'enterprise'
					? 'Enterprise'
					: resolvedApiPlan === 'member'
						? 'Parchment API'
						: 'Explorer',
			hasPaidPlan: apiHasPaidPlan,
			statusLabel:
				resolvedApiPlan === 'enterprise'
					? 'Enterprise access'
					: resolvedApiPlan === 'member'
						? apiStripeSubscription?.cancel_at_period_end
							? 'Paid API active, canceling at period end'
							: 'Paid API active'
						: 'Explorer baseline active',
			tone: apiTone,
			description:
				resolvedApiPlan === 'enterprise'
					? 'Your account resolves to enterprise-grade Parchment API access for custom integrations and commercial support.'
					: resolvedApiPlan === 'member'
						? 'Your account currently has the paid Parchment API plan for production-ready coffee data access.'
						: 'Explorer is the free baseline for Parchment API. Upgrade when you need the paid production tier.',
			sourceLabel: buildApiSourceLabel({
				apiPlan: resolvedApiPlan,
				hasActiveApiSnapshot: hasCurrentApiBillingState,
				hasActiveStripeSubscription: hasCurrentStripeOwnership(apiStripeSubscription),
				stripeSubscription: apiStripeSubscription
			}),
			currentPlan: buildCurrentPlan({
				stripeSubscription: apiStripeSubscription,
				snapshot: apiSnapshot,
				fallbackEntry:
					apiCatalogEntry ??
					(resolvedApiPlan === 'viewer' ? getBillingCatalogEntry('api_plan.explorer') : null)
			}),
			upgradePlans: buildAvailablePlans('api_plan'),
			consoleHref: '/api-dashboard'
		},
		intelligence: {
			enabled: resolvedPpiAccess,
			statusLabel: resolvedPpiAccess
				? intelligenceStripeSubscription?.cancel_at_period_end
					? 'Intelligence active, canceling at period end'
					: 'Intelligence active'
				: 'Locked',
			tone: intelligenceTone,
			description: resolvedPpiAccess
				? 'Parchment Intelligence unlocks the full analytics and market-intelligence layer across supplier, origin, processing, and pricing views.'
				: 'Unlock Parchment Intelligence for the full analytics and market-intelligence layer beyond the limited free floor.',
			sourceLabel: buildIntelligenceSourceLabel({
				ppiAccess: resolvedPpiAccess,
				hasActiveSnapshot: hasCurrentIntelligenceBillingState,
				hasActiveStripeSubscription: hasCurrentStripeOwnership(intelligenceStripeSubscription),
				stripeSubscription: intelligenceStripeSubscription
			}),
			currentPlan: buildCurrentPlan({
				stripeSubscription: intelligenceStripeSubscription,
				snapshot: intelligenceSnapshot,
				fallbackEntry: intelligenceCatalogEntry
			}),
			availablePlans: buildAvailablePlans('ppi_addon')
		},
		enterprise: {
			statusLabel: 'Contact sales',
			tone: 'info',
			description:
				'Enterprise and custom integrations stay contact-only here. Use this path for embedded analytics, custom delivery, procurement, SLAs, or broader commercial support.',
			note: 'Enterprise is visible on the control plane, but it is not a self-serve checkout product.',
			contactHref: '/contact'
		}
	};
}
