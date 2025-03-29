import type { PageServerLoad } from './$types';
import { getStripeCustomerId, getSubscriptionDetails } from '$lib/services/stripe';

// This runs on the server when the page is loaded
export const load: PageServerLoad = async ({ locals }) => {
	// Get session from locals
	const session = locals.session;

	// If user is logged in, check if they already have a Stripe customer ID
	if (session?.user) {
		// Use role already available in locals instead of fetching it again
		const role = locals.role || 'viewer';

		// Get Stripe customer ID from our database
		const stripeCustomerId = await getStripeCustomerId(session.user.id);
		console.log('stripeCustomerId', stripeCustomerId);
		console.log('session', session.user.id);

		// Fetch subscription details if customer ID exists
		let subscription = null;
		if (stripeCustomerId) {
			subscription = await getSubscriptionDetails(stripeCustomerId);
			console.log('subscription', subscription);
		}

		return {
			session,
			role,
			stripeCustomerId,
			subscription
		};
	}

	return {
		session
	};
};
