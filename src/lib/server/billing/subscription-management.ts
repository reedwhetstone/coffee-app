import type { Database } from '$lib/types/database.types';

type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

export type MembershipManagementSnapshot = Pick<
	BillingSubscriptionRow,
	'stripe_subscription_id' | 'product_family' | 'status'
>;

const BUNDLED_MEMBERSHIP_MANAGEMENT_BLOCKING_STATUSES = new Set([
	'active',
	'trialing',
	'past_due',
	'incomplete',
	'unpaid'
]);

function blocksBundledMembershipManagement(status: string): boolean {
	return BUNDLED_MEMBERSHIP_MANAGEMENT_BLOCKING_STATUSES.has(status);
}

export function resolveMembershipSubscriptionManagementState(input: {
	subscriptionId: string | null | undefined;
	billingSubscriptions?: MembershipManagementSnapshot[] | null;
}) {
	const subscriptionId = input.subscriptionId ?? null;
	const matchingRows = (input.billingSubscriptions ?? []).filter(
		(subscription) => subscription.stripe_subscription_id === subscriptionId
	);

	const hasMembership = matchingRows.some(
		(subscription) => subscription.product_family === 'membership'
	);
	const hasBlockingOtherFamilies = matchingRows.some(
		(subscription) =>
			subscription.product_family !== 'membership' &&
			blocksBundledMembershipManagement(subscription.status)
	);

	return {
		hasMatchingRows: matchingRows.length > 0,
		hasMembership,
		hasBlockingOtherFamilies,
		canManage: hasMembership && !hasBlockingOtherFamilies
	};
}
