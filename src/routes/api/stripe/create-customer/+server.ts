import { json } from '@sveltejs/kit';
import { createStripeCustomer, getStripeCustomerId } from '$lib/services/stripe';
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

		// Check if user already has a Stripe customer ID
		const existingCustomerId = await getStripeCustomerId(session.user.id);

		if (existingCustomerId) {
			return json({
				customerId: existingCustomerId,
				existing: true
			});
		}

		// Create a new Stripe customer
		const customerId = await createStripeCustomer(session.user.id, email, name);

		if (!customerId) {
			return json({ error: 'Failed to create customer' }, { status: 500 });
		}

		return json({ customerId, new: true });
	} catch (error) {
		console.error('Error creating Stripe customer:', error);
		return json({ error: 'Failed to create customer' }, { status: 500 });
	}
}
