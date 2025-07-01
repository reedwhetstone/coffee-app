import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCheckoutSession } from '$lib/services/stripe';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Verify that the user is authenticated
		const { session, user } = await locals.safeGetSession();
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { priceId, clientReferenceId, customerEmail } = await request.json();

		if (!priceId) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Get the origin for the return URL
		const origin = request.headers.get('origin') || 'http://localhost:5173';

		// Create a checkout session using our service
		const clientSecret = await createCheckoutSession(
			priceId,
			null, // We don't pass customerId here since we want to capture email for new customers
			clientReferenceId || user.id,
			customerEmail || user.email || '',
			origin
		);

		if (!clientSecret) {
			return json({ error: 'Failed to create checkout session' }, { status: 500 });
		}

		return json({ clientSecret });
	} catch (error: any) {
		console.error('Error creating checkout session:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
