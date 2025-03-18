import { json } from '@sveltejs/kit';
import { createClient } from '$lib/supabase';
import { STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
	// Create Supabase admin client with server-side privileges
	const supabase = createClient();

	// Get the signature from the headers
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		console.error('No Stripe signature found in request');
		return json({ error: 'No signature' }, { status: 400 });
	}

	try {
		// Get the raw body as text
		const body = await request.text();

		// Basic validation
		if (!body) {
			console.error('Empty request body');
			return json({ error: 'Empty body' }, { status: 400 });
		}

		// Initialize Stripe for verification
		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: '2025-02-24.acacia'
		});

		// Verify the webhook signature
		let event;
		try {
			event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
		} catch (err) {
			console.error('Webhook signature verification failed:', err);
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		// Log the event (consider removing in production)
		console.log(`Received Stripe event: ${event.type}`);

		// Handle specific events
		switch (event.type) {
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
				// Handle subscription creation or update
				const subscription = event.data.object;
				if (subscription.status === 'active' || subscription.status === 'trialing') {
					await handleSubscriptionActive(subscription, supabase);
				} else if (
					subscription.status === 'canceled' ||
					subscription.status === 'unpaid' ||
					subscription.status === 'past_due'
				) {
					await handleSubscriptionInactive(subscription, supabase);
				}
				break;

			case 'customer.subscription.deleted':
				// Handle subscription cancellation
				await handleSubscriptionInactive(event.data.object, supabase);
				break;

			// Add other event types as needed
			default:
				console.log(`Unhandled event type: ${event.type}`);
		}

		return json({ received: true });
	} catch (err) {
		console.error('Error processing webhook:', err);
		return json({ error: 'Webhook error' }, { status: 400 });
	}
}

async function handleSubscriptionActive(subscription: any, supabase: any) {
	const customerId = subscription.customer;

	// Get the user_id associated with this Stripe customer
	const { data: customerData, error: customerError } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	if (customerError || !customerData) {
		console.error('Error finding user for Stripe customer:', customerError);
		return;
	}

	const userId = customerData.user_id;

	// Update user role to 'member'
	const { error: updateError } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'member' }, { onConflict: 'id' });

	if (updateError) {
		console.error('Error updating user role:', updateError);
	} else {
		console.log(`Updated user ${userId} to member role`);
	}
}

async function handleSubscriptionInactive(subscription: any, supabase: any) {
	const customerId = subscription.customer;

	// Get the user_id associated with this Stripe customer
	const { data: customerData, error: customerError } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	if (customerError || !customerData) {
		console.error('Error finding user for Stripe customer:', customerError);
		return;
	}

	const userId = customerData.user_id;

	// Update user role to 'viewer'
	const { error: updateError } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'viewer' }, { onConflict: 'id' });

	if (updateError) {
		console.error('Error updating user role:', updateError);
	} else {
		console.log(`Updated user ${userId} to viewer role`);
	}
}
