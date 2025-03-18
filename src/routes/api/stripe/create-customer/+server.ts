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

		// Create a new Stripe customer
		const customer = await stripe.customers.create({
			email,
			name: name || undefined,
			metadata: {
				supabaseUserId: session.user.id
			}
		});

		// Store the customer ID in Supabase
		const supabase = createClient();
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

		return json({ customerId: customer.id });
	} catch (error) {
		console.error('Error creating Stripe customer:', error);
		return json({ error: 'Failed to create customer' }, { status: 500 });
	}
}
