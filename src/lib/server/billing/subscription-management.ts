import { isBillingSubscriptionActive } from '$lib/server/billing/entitlements';
import type { Database } from '$lib/types/database.types';

type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

export type MembershipManagementSnapshot = Pick<
	BillingSubscriptionRow,
	'stripe_subscription_id' | 'product_family' | 'status'
>;

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
	const hasActiveOtherFamilies = matchingRows.some(
		(subscription) =>
			subscription.product_family !== 'membership' &&
			isBillingSubscriptionActive(subscription.status)
	);

	return {
		hasMatchingRows: matchingRows.length > 0,
		hasMembership,
		hasActiveOtherFamilies,
		canManage: hasMembership && !hasActiveOtherFamilies
	};
}
