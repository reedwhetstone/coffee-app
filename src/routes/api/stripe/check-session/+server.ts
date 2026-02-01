import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/services/stripe';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Verify that the user is authenticated
		const session = locals.session;
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sessionId = url.searchParams.get('session_id');
		if (!sessionId) {
			return json({ error: 'Missing session_id parameter' }, { status: 400 });
		}

		// Get Stripe instance and retrieve the Checkout Session
		const stripe = getStripe();
		const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

		// Return the status of the checkout session
		return json({
			status: checkoutSession.status,
			customer: checkoutSession.customer,
			clientSecret: checkoutSession.client_secret,
			paymentStatus: checkoutSession.payment_status
		});
	} catch (error) {
		console.error('Error checking session status:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
