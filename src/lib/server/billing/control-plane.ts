import type { SubscriptionDetails } from '$lib/services/stripe';
import { isBillingSubscriptionActive } from '$lib/server/billing/entitlements';
import type { UserRole } from '$lib/types/auth.types';
import type { Database } from '$lib/types/database.types';

type ApiPlan = Database['public']['Tables']['user_roles']['Row']['api_plan'];

type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

type BillingSubscriptionSnapshot = Pick<
	BillingSubscriptionRow,
	'product_family' | 'product_key' | 'status' | 'cancel_at_period_end' | 'current_period_end'
>;

type ControlPlaneTone = 'success' | 'info' | 'warning' | 'muted';

export interface SubscriptionControlPlaneState {
	membership: {
		hasAccess: boolean;
		statusLabel: string;
		tone: ControlPlaneTone;
		sourceLabel: string;
		description: string;
		canManageSubscription: boolean;
		stripeStatus: SubscriptionDetails['status'] | null;
		cancelAtPeriodEnd: boolean;
		currentPeriodEnd: number | null;
		planName: string | null;
	};
	api: {
		plan: ApiPlan;
		statusLabel: string;
		tone: ControlPlaneTone;
		description: string;
		note: string;
	};
	ppi: {
		enabled: boolean;
		statusLabel: string;
		tone: ControlPlaneTone;
		description: string;
		note: string;
	};
}

function hasActiveFamilySubscription(
	subscriptions: BillingSubscriptionSnapshot[],
	family: BillingSubscriptionSnapshot['product_family']
): boolean {
	return subscriptions.some(
		(subscription) =>
			subscription.product_family === family && isBillingSubscriptionActive(subscription.status)
	);
}

function membershipSourceLabel(input: {
	role: UserRole;
	hasActiveMembershipSnapshot: boolean;
	stripeSubscription: SubscriptionDetails | null;
}): string {
	if (input.role === 'admin') {
		return 'Admin access is preserved independently of Stripe billing.';
	}

	if (input.hasActiveMembershipSnapshot && input.stripeSubscription?.cancel_at_period_end) {
		return 'Backed by an active Stripe membership that is set to cancel at period end.';
	}

	if (input.hasActiveMembershipSnapshot) {
		return 'Backed by your reconciled Stripe membership snapshot.';
	}

	if (input.role === 'member') {
		return 'Your resolved entitlements still grant membership access.';
	}

	if (input.stripeSubscription) {
		return `Latest Stripe subscription status: ${input.stripeSubscription.status}.`;
	}

	return 'No active membership entitlement is currently on file.';
}

export function buildSubscriptionControlPlaneState(input: {
	role: UserRole;
	apiPlan: ApiPlan;
	ppiAccess: boolean;
	billingSubscriptions?: BillingSubscriptionSnapshot[] | null;
	stripeSubscription?: SubscriptionDetails | null;
}): SubscriptionControlPlaneState {
	const billingSubscriptions = input.billingSubscriptions ?? [];
	const stripeSubscription = input.stripeSubscription ?? null;
	const hasActiveMembershipSnapshot = hasActiveFamilySubscription(
		billingSubscriptions,
		'membership'
	);
	const membershipHasAccess = input.role === 'member' || input.role === 'admin';

	const membershipTone: ControlPlaneTone =
		input.role === 'admin'
			? 'info'
			: membershipHasAccess
				? stripeSubscription?.cancel_at_period_end
					? 'warning'
					: 'success'
				: 'muted';

	const membershipStatusLabel =
		input.role === 'admin'
			? 'Admin access'
			: membershipHasAccess
				? stripeSubscription?.cancel_at_period_end
					? 'Membership active, canceling at period end'
					: 'Membership active'
				: 'Free viewer access';

	const apiTone: ControlPlaneTone = input.apiPlan === 'viewer' ? 'muted' : 'success';
	const apiStatusLabel =
		input.apiPlan === 'enterprise'
			? 'Enterprise API access'
			: input.apiPlan === 'member'
				? 'Member API access'
				: 'Viewer API access';

	const ppiTone: ControlPlaneTone = input.ppiAccess ? 'success' : 'muted';

	return {
		membership: {
			hasAccess: membershipHasAccess,
			statusLabel: membershipStatusLabel,
			tone: membershipTone,
			sourceLabel: membershipSourceLabel({
				role: input.role,
				hasActiveMembershipSnapshot,
				stripeSubscription
			}),
			description: membershipHasAccess
				? 'Membership unlocks roast management and the paid core app surfaces.'
				: 'Upgrade to membership to unlock roast management, full concierge access, inventory tracking, and premium journaling tools.',
			canManageSubscription: Boolean(stripeSubscription?.id),
			stripeStatus: stripeSubscription?.status ?? null,
			cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end ?? false,
			currentPeriodEnd: stripeSubscription?.current_period_end ?? null,
			planName: stripeSubscription?.plan?.name ?? null
		},
		api: {
			plan: input.apiPlan,
			statusLabel: apiStatusLabel,
			tone: apiTone,
			description:
				input.apiPlan === 'enterprise'
					? 'Your account currently resolves to the highest API entitlement tier.'
					: input.apiPlan === 'member'
						? 'Your account currently resolves to member-level API access.'
						: 'Your account currently resolves to the baseline viewer API plan.',
			note: 'Separate API checkout is not live yet. This section reflects your resolved entitlement state only.'
		},
		ppi: {
			enabled: input.ppiAccess,
			statusLabel: input.ppiAccess ? 'PPI access enabled' : 'PPI access not enabled',
			tone: ppiTone,
			description: input.ppiAccess
				? 'Your account currently includes the richer analytics and product intelligence surfaces.'
				: 'You still keep the limited free viewer chart experience, but richer PPI analytics are not enabled on this account.',
			note: 'PPI is not yet sold as a separate checkout flow here. This section is status and guidance for the current entitlement model.'
		}
	};
}
