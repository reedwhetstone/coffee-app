import type { PageServerLoad } from './$types';
import { createClient } from '$lib/supabase';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';

// This runs on the server when the page is loaded
export const load: PageServerLoad = async ({ locals }) => {
	// Get session from locals
	const session = locals.session;

	// If user is logged in, check if they already have a Stripe customer ID
	if (session?.user) {
		const supabase = createClient();

		// Use role already available in locals instead of fetching it again
		const role = locals.role || 'viewer';

		// Check if user already exists in stripe_customers table
		const { data: customerData, error: customerError } = await supabase
			.from('stripe_customers')
			.select('customer_id')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (customerError) {
			console.error('Error checking for Stripe customer:', customerError);
		}

		const stripeCustomerId = customerData?.customer_id || null;

		// Fetch subscription details regardless of role to avoid circular dependency
		// (we need subscription details to confirm membership status)
		let subscription = null;
		if (stripeCustomerId) {
			try {
				const stripe = new Stripe(STRIPE_SECRET_KEY, {
					apiVersion: '2025-02-24.acacia'
				});

				// Fetch all subscriptions for the customer
				const subscriptions = await stripe.subscriptions.list({
					customer: stripeCustomerId,
					status: 'all',
					expand: ['data.default_payment_method']
				});

				// Get the most recent active subscription
				const activeSubscription = subscriptions.data.find(
					(sub) => sub.status === 'active' || sub.status === 'trialing'
				);

				if (activeSubscription) {
					subscription = {
						id: activeSubscription.id,
						status: activeSubscription.status,
						current_period_end: activeSubscription.current_period_end,
						cancel_at_period_end: activeSubscription.cancel_at_period_end,
						plan: {
							name: activeSubscription.items.data[0]?.price?.product as string,
							amount: activeSubscription.items.data[0]?.price?.unit_amount,
							interval: activeSubscription.items.data[0]?.price?.recurring?.interval,
							interval_count: activeSubscription.items.data[0]?.price?.recurring?.interval_count
						},
						payment_method: activeSubscription.default_payment_method
					};
				}
			} catch (error) {
				console.error('Error fetching subscription data:', error);
			}
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
