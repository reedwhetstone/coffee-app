import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

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

		// Retrieve the Checkout Session
		const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

		// Return the status of the checkout session
		return json({
			status: checkoutSession.status,
			customer: checkoutSession.customer,
			clientSecret: checkoutSession.client_secret,
			paymentStatus: checkoutSession.payment_status
		});
	} catch (error: any) {
		console.error('Error checking session status:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
