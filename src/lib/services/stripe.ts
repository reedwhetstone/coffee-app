import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { createClient } from '$lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Initialize Stripe with the latest API version
export const getStripe = () =>
	new Stripe(STRIPE_SECRET_KEY, {
		apiVersion: '2025-02-24.acacia'
	});

// User subscription types
export type SubscriptionStatus =
	| 'active'
	| 'trialing'
	| 'canceled'
	| 'incomplete'
	| 'incomplete_expired'
	| 'past_due'
	| 'unpaid';

export interface SubscriptionDetails {
	id: string;
	status: SubscriptionStatus;
	current_period_end: number;
	cancel_at_period_end: boolean;
	plan?: {
		name: string;
		amount: number | null;
		interval: string | null;
		interval_count: number | null;
	};
	payment_method?: Stripe.PaymentMethod | null;
}

/**
 * Get Stripe customer ID for a user
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from('stripe_customers')
		.select('customer_id')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.error('Error fetching Stripe customer ID:', error);
		return null;
	}

	return data?.customer_id || null;
}

/**
 * Create a new Stripe customer
 */
export async function createStripeCustomer(
	userId: string,
	email: string,
	name?: string
): Promise<string | null> {
	const stripe = getStripe();
	const supabase = createClient();

	try {
		// Create customer in Stripe
		const customer = await stripe.customers.create({
			email,
			name: name || undefined,
			metadata: {
				supabaseUserId: userId
			}
		});

		// Store the customer ID in Supabase
		const { error } = await supabase.from('stripe_customers').upsert(
			{
				user_id: userId,
				customer_id: customer.id,
				email
			},
			{
				onConflict: 'user_id'
			}
		);

		if (error) {
			console.error('Error storing Stripe customer:', error);
			return null;
		}

		return customer.id;
	} catch (error) {
		console.error('Error creating Stripe customer:', error);
		return null;
	}
}

/**
 * Get subscription details for a customer
 */
export async function getSubscriptionDetails(
	customerId: string
): Promise<SubscriptionDetails | null> {
	try {
		const stripe = getStripe();

		// Fetch all subscriptions for the customer
		const subscriptions = await stripe.subscriptions.list({
			customer: customerId,
			status: 'all',
			expand: ['data.default_payment_method']
		});

		// Get the most recent active subscription
		const activeSubscription = subscriptions.data.find(
			(sub) => sub.status === 'active' || sub.status === 'trialing'
		);

		if (activeSubscription) {
			const priceItem = activeSubscription.items.data[0]?.price;

			return {
				id: activeSubscription.id,
				status: activeSubscription.status as SubscriptionStatus,
				current_period_end: activeSubscription.current_period_end,
				cancel_at_period_end: activeSubscription.cancel_at_period_end,
				plan: {
					name: typeof priceItem?.product === 'string' ? priceItem.product : 'Premium Plan',
					amount: priceItem?.unit_amount,
					interval: priceItem?.recurring?.interval || null,
					interval_count: priceItem?.recurring?.interval_count || null
				},
				payment_method: activeSubscription.default_payment_method as Stripe.PaymentMethod | null
			};
		}

		return null;
	} catch (error) {
		console.error('Error fetching subscription data:', error);
		return null;
	}
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
	try {
		const stripe = getStripe();
		await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true
		});
		return true;
	} catch (error) {
		console.error('Error canceling subscription:', error);
		return false;
	}
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<boolean> {
	try {
		const stripe = getStripe();
		await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: false
		});
		return true;
	} catch (error) {
		console.error('Error resuming subscription:', error);
		return false;
	}
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
	priceId: string,
	customerId: string | null,
	clientReferenceId: string,
	customerEmail: string,
	origin: string
): Promise<string | null> {
	try {
		const stripe = getStripe();

		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			payment_method_types: ['card'],
			line_items: [
				{
					price: priceId,
					quantity: 1
				}
			],
			mode: 'subscription',
			ui_mode: 'embedded',
			return_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
			client_reference_id: clientReferenceId
		};

		// Add customer info
		if (customerId) {
			sessionParams.customer = customerId;
		} else if (customerEmail) {
			sessionParams.customer_email = customerEmail;
		}

		const session = await stripe.checkout.sessions.create(sessionParams);
		return session.client_secret;
	} catch (error) {
		console.error('Error creating checkout session:', error);
		return null;
	}
}
