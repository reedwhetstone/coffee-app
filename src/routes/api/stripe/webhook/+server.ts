import { json } from '@sveltejs/kit';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import type { RequestEvent } from '@sveltejs/kit';
import {
	constructStripeEvent,
	createAdminSupabase,
	handleSubscriptionActive,
	handleSubscriptionInactive
} from '$lib/services/stripe-webhook';
import { getStripe } from '$lib/services/stripe';

export async function POST({ request }: RequestEvent) {
	console.log('🔔 Webhook endpoint called');

	// Create Supabase admin client with service role privileges
	const supabase = createAdminSupabase();
	console.log('📊 Using service role client for database operations');

	// Get the signature from the headers
	const signature = request.headers.get('stripe-signature');
	console.log('🔑 Stripe signature present:', !!signature);

	if (!signature) {
		console.error('❌ No Stripe signature found in request');
		return json({ error: 'No signature' }, { status: 400 });
	}

	try {
		// Get the raw body as text
		const body = await request.text();
		console.log('📦 Webhook body length:', body.length);
		console.log('📦 Webhook body preview:', body.substring(0, 200) + '...');

		// Basic validation
		if (!body) {
			console.error('❌ Empty request body');
			return json({ error: 'Empty body' }, { status: 400 });
		}

		// Verify webhook signature
		const event = await constructStripeEvent(body, signature, STRIPE_WEBHOOK_SECRET);
		if (!event) {
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		console.log('✅ Webhook signature verified successfully');
		console.log(`📣 Received Stripe event: ${event.type}`);
		console.log('📊 Event data:', JSON.stringify(event.data.object).substring(0, 200) + '...');

		// Handle specific events
		switch (event.type) {
			case 'checkout.session.completed':
				// Handle successful checkout
				const session = event.data.object;
				console.log('💰 Checkout session completed');
				console.log('🧑 Customer ID:', session.customer);
				console.log('📝 Subscription ID:', session.subscription);

				// Check if client_reference_id contains a Supabase user ID
				if (session.client_reference_id && session.customer) {
					console.log('🔑 Client reference ID found:', session.client_reference_id);

					// Store this ID as supabaseUserId in the customer metadata
					try {
						const stripe = getStripe();
						const customerId =
							typeof session.customer === 'string' ? session.customer : session.customer.id;

						await stripe.customers.update(customerId, {
							metadata: {
								supabaseUserId: session.client_reference_id
							}
						});
						console.log('✅ Updated customer metadata with user ID');
					} catch (err) {
						console.error('❌ Error updating customer metadata:', err);
					}
				}

				// If this created a subscription, handle it
				if (session.mode === 'subscription' && session.subscription) {
					console.log('✅ Subscription created in checkout, retrieving details');
					try {
						const stripe = getStripe();
						const subscriptionId =
							typeof session.subscription === 'string'
								? session.subscription
								: session.subscription.id;

						const subscription = await stripe.subscriptions.retrieve(subscriptionId);
						await handleSubscriptionActive(subscription, supabase);
					} catch (err) {
						console.error('❌ Error retrieving subscription details:', err);
					}
				}
				break;

			case 'customer.subscription.created':
			case 'customer.subscription.updated':
				// Handle subscription creation or update
				const subscription = event.data.object;
				console.log('📋 Subscription status:', subscription.status);

				if (subscription.status === 'active' || subscription.status === 'trialing') {
					console.log('✅ Handling active subscription');
					await handleSubscriptionActive(subscription, supabase);
				} else if (
					subscription.status === 'canceled' ||
					subscription.status === 'unpaid' ||
					subscription.status === 'past_due'
				) {
					console.log('⚠️ Handling inactive subscription');
					await handleSubscriptionInactive(subscription, supabase);
				}
				break;

			case 'customer.subscription.deleted':
				// Handle subscription cancellation
				console.log('❌ Handling deleted subscription');
				await handleSubscriptionInactive(event.data.object, supabase);
				break;

			default:
				console.log(`⚠️ Unhandled event type: ${event.type}`);
		}

		console.log('✅ Webhook processing completed successfully');
		return json({ received: true });
	} catch (err) {
		console.error('❌ Error processing webhook:', err);
		return json({ error: 'Webhook error' }, { status: 400 });
	}
}
