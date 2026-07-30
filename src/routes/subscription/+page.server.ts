import { buildSubscriptionControlPlaneState } from '$lib/server/billing/control-plane';
import { getStripeCustomerId, getSubscriptionDetails } from '$lib/services/stripe';
import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals.principal);

	if (!user) {
		return {
			stripeCustomerId: null,
			subscription: null,
			billingSubscriptions: [],
			controlPlane: null
		};
	}

	const apiPlan = locals.principal.apiPlan ?? 'viewer';
	const ppiAccess = locals.principal.ppiAccess;
	const stripeCustomerId = await getStripeCustomerId(user.id);

	let subscription = null;
	if (stripeCustomerId) {
		subscription = await getSubscriptionDetails(stripeCustomerId, {
			productFamily: 'membership'
		});
	}

	const { data: billingSubscriptions, error: billingSubscriptionsError } = await locals.supabase
		.from('billing_subscriptions')
		.select(
			'stripe_subscription_id, product_family, product_key, status, cancel_at_period_end, current_period_end'
		)
		.eq('user_id', user.id);

	if (billingSubscriptionsError) {
		console.error('Error loading billing subscription snapshots:', billingSubscriptionsError);
	}

	return {
		stripeCustomerId,
		subscription,
		billingSubscriptions: billingSubscriptions ?? [],
		controlPlane: buildSubscriptionControlPlaneState({
			role,
			apiPlan,
			ppiAccess,
			billingSubscriptions: billingSubscriptions ?? [],
			stripeSubscription: subscription
		})
	};
};
