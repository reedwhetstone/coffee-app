import { json } from '@sveltejs/kit';
import { createClient } from '$lib/supabase';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
	// Ensure the user is authenticated
	const session = locals.session;
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { email, name } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Initialize Stripe
		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: '2025-02-24.acacia' // Latest API version
		});

		// Check if user already has a Stripe customer in our database
		const supabase = createClient();
		const { data: existingCustomer, error: lookupError } = await supabase
			.from('stripe_customers')
			.select('customer_id')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (lookupError) {
			console.error('Error looking up existing Stripe customer:', lookupError);
		}

		// If we found an existing customer ID, verify it exists in Stripe
		if (existingCustomer?.customer_id) {
			try {
				// Verify the customer exists in Stripe
				const existingStripeCustomer = await stripe.customers.retrieve(
					existingCustomer.customer_id
				);

				if (existingStripeCustomer && !existingStripeCustomer.deleted) {
					console.log('Using existing Stripe customer:', existingCustomer.customer_id);
					return json({
						customerId: existingCustomer.customer_id,
						existing: true
					});
				}
				// If customer was deleted in Stripe, we'll create a new one below
			} catch (stripeError) {
				// If the customer doesn't exist in Stripe anymore, we'll create a new one
				console.log('Stripe customer lookup failed, will create new customer:', stripeError);
			}
		}

		// Create a new Stripe customer
		console.log('Creating new Stripe customer for user:', session.user.id);
		const customer = await stripe.customers.create({
			email,
			name: name || undefined,
			metadata: {
				supabaseUserId: session.user.id
			}
		});

		// Store the customer ID in Supabase
		const { error } = await supabase.from('stripe_customers').upsert(
			{
				user_id: session.user.id,
				customer_id: customer.id,
				email
			},
			{
				onConflict: 'user_id'
			}
		);

		if (error) {
			console.error('Error storing Stripe customer:', error);
			return json({ error: 'Database error' }, { status: 500 });
		}

		return json({ customerId: customer.id, new: true });
	} catch (error) {
		console.error('Error creating Stripe customer:', error);
		return json({ error: 'Failed to create customer' }, { status: 500 });
	}
}
