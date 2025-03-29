import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';

const stripe = new Stripe(STRIPE_SECRET_KEY);

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Verify that the user is authenticated
		const session = locals.session;
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { priceId, clientReferenceId, customerEmail } = await request.json();

		if (!priceId) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Create a Stripe Checkout Session for embedded checkout
		const checkoutSession = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price: priceId,
					quantity: 1
				}
			],
			mode: 'subscription',
			ui_mode: 'embedded', // This is what makes it embedded
			return_url: `${request.headers.get('origin') || 'http://localhost:5173'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
			customer_email: customerEmail || session.user.email,
			client_reference_id: clientReferenceId || session.user.id
		});

		return json({ clientSecret: checkoutSession.client_secret });
	} catch (error: any) {
		console.error('Error creating checkout session:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
