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
			billingSubscriptions: [],
			controlPlane: null
		};
	}

	const role = locals.role || 'viewer';
	const apiPlan = locals.principal?.apiPlan ?? 'viewer';
	const ppiAccess = locals.principal?.ppiAccess ?? false;
	const stripeCustomerId = await getStripeCustomerId(user.id);

	const { data: billingSubscriptions, error: billingSubscriptionsError } = await locals.supabase
		.from('billing_subscriptions')
		.select(
			'stripe_subscription_id, product_family, product_key, status, cancel_at_period_end, current_period_end'
		)
		.eq('user_id', user.id);

	if (billingSubscriptionsError) {
		console.error('Error loading billing subscription snapshots:', billingSubscriptionsError);
	}

	const stripeSubscriptions = stripeCustomerId
		? await Promise.all([
				getSubscriptionDetails(stripeCustomerId, {
					productFamily: 'membership'
				}),
				getSubscriptionDetails(stripeCustomerId, {
					productFamily: 'api_plan'
				}),
				getSubscriptionDetails(stripeCustomerId, {
					productFamily: 'ppi_addon'
				})
			]).then(([membership, api, intelligence]) => ({
				membership,
				api,
				intelligence
			}))
		: {
				membership: null,
				api: null,
				intelligence: null
			};

	return {
		session,
		user,
		role,
		stripeCustomerId,
		billingSubscriptions: billingSubscriptions ?? [],
		controlPlane: buildSubscriptionControlPlaneState({
			role,
			apiPlan,
			ppiAccess,
			billingSubscriptions: billingSubscriptions ?? [],
			stripeSubscriptions
		})
	};
};
