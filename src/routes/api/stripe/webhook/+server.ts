import { json } from '@sveltejs/kit';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import type { RequestEvent } from '@sveltejs/kit';

import {
	constructStripeEvent,
	createAdminSupabase,
	reconcileStripeSubscription
} from '$lib/services/stripe-webhook';
import { getStripe } from '$lib/services/stripe';

export async function POST({ request }: RequestEvent) {
	console.log('🔔 Webhook endpoint called');

	const supabase = createAdminSupabase();
	console.log('📊 Using service role client for database operations');

	const signature = request.headers.get('stripe-signature');
	console.log('🔑 Stripe signature present:', !!signature);

	if (!signature) {
		console.error('❌ No Stripe signature found in request');
		return json({ error: 'No signature' }, { status: 400 });
	}

	try {
		const body = await request.text();
		console.log('📦 Webhook body length:', body.length);
		console.log('📦 Webhook body preview:', body.substring(0, 200) + '...');

		if (!body) {
			console.error('❌ Empty request body');
			return json({ error: 'Empty body' }, { status: 400 });
		}

		const event = await constructStripeEvent(body, signature, STRIPE_WEBHOOK_SECRET);
		if (!event) {
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		console.log('✅ Webhook signature verified successfully');
		console.log(`📣 Received Stripe event: ${event.type}`);
		console.log('📊 Event data:', JSON.stringify(event.data.object).substring(0, 200) + '...');

		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object;
				console.log('💰 Checkout session completed');
				console.log('🧑 Customer ID:', session.customer);
				console.log('📝 Subscription ID:', session.subscription);

				if (session.client_reference_id && session.customer) {
					console.log('🔑 Client reference ID found:', session.client_reference_id);

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

				if (session.mode === 'subscription' && session.subscription) {
					console.log('✅ Subscription created in checkout, retrieving details');
					try {
						const stripe = getStripe();
						const subscriptionId =
							typeof session.subscription === 'string'
								? session.subscription
								: session.subscription.id;

						const subscription = await stripe.subscriptions.retrieve(subscriptionId);
						await reconcileStripeSubscription(subscription, supabase);
					} catch (err) {
						console.error('❌ Error retrieving subscription details:', err);
					}
				}
				break;
			}

			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted':
				await reconcileStripeSubscription(event.data.object, supabase);
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
