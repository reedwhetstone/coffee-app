import { json } from '@sveltejs/kit';
import { createStripeCustomer, getStripeCustomerId } from '$lib/services/stripe';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
	// Ensure the user is authenticated
	const { session, user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { email, name } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Check if user already has a Stripe customer ID
		const existingCustomerId = await getStripeCustomerId(user.id);

		if (existingCustomerId) {
			return json({
				customerId: existingCustomerId,
				existing: true
			});
		}

		// Create a new Stripe customer
		const customerId = await createStripeCustomer(user.id, email, name);

		if (!customerId) {
			return json({ error: 'Failed to create customer' }, { status: 500 });
		}

		return json({ customerId, new: true });
	} catch (error) {
		console.error('Error creating Stripe customer:', error);
		return json({ error: 'Failed to create customer' }, { status: 500 });
	}
}
