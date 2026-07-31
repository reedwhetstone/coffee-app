import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * Retired legacy customer-creation lane. Stripe identities are now created
 * only as part of a fenced Checkout admission and reconciled before account
 * deletion can finalize.
 */
export const POST: RequestHandler = () =>
	json(
		{
			error: {
				code: 'stripe_customer_creation_retired',
				message: 'Use the Checkout flow to create Stripe customer identities.'
			}
		},
		{ status: 410, headers: { 'cache-control': 'no-store' } }
	);
