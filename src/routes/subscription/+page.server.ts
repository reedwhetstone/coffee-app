import { buildSubscriptionControlPlaneState } from '$lib/server/billing/control-plane';
import { getStripeCustomerId, getSubscriptionDetails } from '$lib/services/stripe';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!user) {
		return {
			session,
			user: null,
			role: 'viewer' as const,
			stripeCustomerId: null,
			subscription: null,
			billingSubscriptions: [],
			controlPlane: null
		};
	}

	const role = locals.role || 'viewer';
	const apiPlan = locals.principal?.apiPlan ?? 'viewer';
	const ppiAccess = locals.principal?.ppiAccess ?? false;
	const stripeCustomerId = await getStripeCustomerId(user.id);

	let subscription = null;
	if (stripeCustomerId) {
		subscription = await getSubscriptionDetails(stripeCustomerId);
	}

	const { data: billingSubscriptions, error: billingSubscriptionsError } = await locals.supabase
		.from('billing_subscriptions')
		.select('product_family, product_key, status, cancel_at_period_end, current_period_end')
		.eq('user_id', user.id);

	if (billingSubscriptionsError) {
		console.error('Error loading billing subscription snapshots:', billingSubscriptionsError);
	}

	return {
		session,
		user,
		role,
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
