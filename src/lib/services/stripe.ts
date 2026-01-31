import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { createAdminClient } from '$lib/supabase-admin';

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

interface StripeCustomerRow {
	user_id: string;
	customer_id: string;
	email: string | null;
}

/**
 * Get Stripe customer ID for a user
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
	// Use the admin client to bypass RLS
	const supabase = createAdminClient();

	const { data, error } = await (supabase as any)
		.from('stripe_customers')
		.select('customer_id')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.error('Error fetching Stripe customer ID:', error);
		return null;
	}
	console.log('data', data);
	return (data as unknown as StripeCustomerRow)?.customer_id || null;
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
	const supabase = createAdminClient();

	try {
		// First, check if this user had any previous customers in Stripe
		// by searching for customers with this email
		const existingCustomers = await stripe.customers.list({
			email: email,
			limit: 10
		});

		// If there are existing customers with metadata matching this user,
		// we'll use the most recent one instead of creating a new one
		const existingCustomer = existingCustomers.data.find(
			(cust) => cust.metadata?.supabaseUserId === userId
		);

		let customerId;

		if (existingCustomer) {
			console.log('Using existing Stripe customer:', existingCustomer.id);
			customerId = existingCustomer.id;
		} else {
			// Create a new customer in Stripe
			const newCustomer = await stripe.customers.create({
				email,
				name: name || undefined,
				metadata: {
					supabaseUserId: userId
				}
			});
			customerId = newCustomer.id;
		}

		// Store or update the customer ID in Supabase
		const { error } = await (supabase as any).from('stripe_customers').upsert(
			{
				user_id: userId,
				customer_id: customerId,
				email
			} as unknown as StripeCustomerRow,
			{
				onConflict: 'user_id'
			}
		);

		if (error) {
			console.error('Error storing Stripe customer:', error);
			return null;
		}

		return customerId;
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

		console.log('subscriptions', subscriptions);

		// If no subscriptions found
		if (subscriptions.data.length === 0) {
			return null;
		}

		// Get the most recent subscription (regardless of status)
		// Sort by created date descending to get most recent first
		const sortedSubscriptions = [...subscriptions.data].sort((a, b) => b.created - a.created);
		const latestSubscription = sortedSubscriptions[0];

		const priceItem = latestSubscription.items.data[0]?.price;

		return {
			id: latestSubscription.id,
			status: latestSubscription.status as SubscriptionStatus,
			current_period_end: latestSubscription.current_period_end,
			cancel_at_period_end: latestSubscription.cancel_at_period_end,
			plan: {
				name: typeof priceItem?.product === 'string' ? priceItem.product : 'Premium Plan',
				amount: priceItem?.unit_amount,
				interval: priceItem?.recurring?.interval || null,
				interval_count: priceItem?.recurring?.interval_count || null
			},
			payment_method: latestSubscription.default_payment_method as Stripe.PaymentMethod | null
		};
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
			client_reference_id: clientReferenceId,
			allow_promotion_codes: true,
			subscription_data: {
				trial_period_days: 14
			}
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

/**
 * Clean up and reset a user's Stripe customer data
 * This is useful for fixing misaligned customer IDs
 */
export async function cleanupStripeCustomer(userId: string, email: string): Promise<boolean> {
	const stripe = getStripe();
	const supabase = createAdminClient();

	try {
		console.log(`Cleaning up Stripe customer data for user ${userId}`);

		// 1. Delete the mapping in Supabase
		const { error: deleteError } = await supabase
			.from('stripe_customers')
			.delete()
			.eq('user_id', userId);

		if (deleteError) {
			console.error('Error deleting Stripe customer from Supabase:', deleteError);
			return false;
		}

		// 2. Find all customers in Stripe with this email or supabaseUserId
		const existingCustomers = await stripe.customers.list({
			email: email,
			limit: 10
		});

		// Find customers linked to this user ID
		const linkedCustomers = existingCustomers.data.filter(
			(cust) => cust.metadata?.supabaseUserId === userId
		);

		// 3. Optional: Update all these customers to clear the link
		for (const customer of linkedCustomers) {
			console.log(`Removing user link from Stripe customer ${customer.id}`);
			await stripe.customers.update(customer.id, {
				metadata: {
					supabaseUserId: '', // Clear the link
					cleanedAt: new Date().toISOString()
				}
			});
		}

		console.log('Stripe customer data cleanup completed');
		return true;
	} catch (error) {
		console.error('Error cleaning up Stripe customer:', error);
		return false;
	}
}
