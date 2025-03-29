import { json } from '@sveltejs/kit';
import { createClient } from '$lib/supabase';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
	// Ensure user is authenticated
	const session = locals.session;
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { subscriptionId } = await request.json();

		if (!subscriptionId) {
			return json({ error: 'Subscription ID is required' }, { status: 400 });
		}

		// Initialize Stripe
		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: '2025-02-24.acacia'
		});

		// Get user's supabase client
		const supabase = createClient();

		// Verify the subscription belongs to the current user
		const { data: customerData } = await supabase
			.from('stripe_customers')
			.select('customer_id')
			.eq('user_id', session.user.id)
			.single();

		if (!customerData?.customer_id) {
			return json({ error: 'Customer record not found' }, { status: 404 });
		}

		// Get the subscription
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);

		// Verify ownership
		if (subscription.customer !== customerData.customer_id) {
			return json({ error: 'Unauthorized to manage this subscription' }, { status: 403 });
		}

		// Cancel at period end
		const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true
		});

		return json({
			success: true,
			cancel_at_period_end: updatedSubscription.cancel_at_period_end,
			current_period_end: updatedSubscription.current_period_end
		});
	} catch (error) {
		console.error('Error canceling subscription:', error);
		return json({ error: 'Failed to cancel subscription' }, { status: 500 });
	}
}
