import { STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { createAdminClient } from '$lib/supabase-admin';
import {
	getBillingCatalogEntryByStripePriceId,
	type BillingProductFamily
} from '$lib/server/billing/catalog';
import { buildCheckoutAdmissionMetadata } from '$lib/server/billing/checkoutAdmissions';

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

interface GetSubscriptionDetailsOptions {
	productFamily?: BillingProductFamily;
}

function matchesProductFamily(
	item: Stripe.SubscriptionItem,
	productFamily: BillingProductFamily
): boolean {
	return getBillingCatalogEntryByStripePriceId(item.price.id)?.productFamily === productFamily;
}

/**
 * Get Stripe customer ID for a user
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
	// Use the admin client to bypass RLS
	const supabase = createAdminClient();

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
 * Get subscription details for a customer
 */
export async function getSubscriptionDetails(
	customerId: string,
	options: GetSubscriptionDetailsOptions = {}
): Promise<SubscriptionDetails | null> {
	try {
		const stripe = getStripe();

		// Fetch all subscriptions for the customer
		const subscriptions = await stripe.subscriptions.list({
			customer: customerId,
			status: 'all',
			expand: ['data.default_payment_method']
		});

		// If no subscriptions found
		if (subscriptions.data.length === 0) {
			return null;
		}

		const matchingSubscriptions = options.productFamily
			? subscriptions.data.filter((subscription) =>
					subscription.items.data.some((item) => matchesProductFamily(item, options.productFamily!))
				)
			: subscriptions.data;

		if (matchingSubscriptions.length === 0) {
			return null;
		}

		// Get the most recent subscription (regardless of status)
		// Sort by created date descending to get most recent first
		const sortedSubscriptions = [...matchingSubscriptions].sort((a, b) => b.created - a.created);
		const latestSubscription = sortedSubscriptions[0];

		const matchedItem = options.productFamily
			? latestSubscription.items.data.find((item) =>
					matchesProductFamily(item, options.productFamily!)
				)
			: latestSubscription.items.data[0];
		const priceItem = matchedItem?.price;
		const catalogEntry = priceItem ? getBillingCatalogEntryByStripePriceId(priceItem.id) : null;

		return {
			id: latestSubscription.id,
			status: latestSubscription.status as SubscriptionStatus,
			current_period_end: latestSubscription.current_period_end,
			cancel_at_period_end: latestSubscription.cancel_at_period_end,
			plan: {
				name:
					catalogEntry?.planName ||
					(typeof priceItem?.product === 'string' ? priceItem.product : 'Premium Plan'),
				amount: priceItem?.unit_amount ?? null,
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
	priceIds: string[],
	customerId: string | null,
	clientReferenceId: string,
	customerEmail: string,
	origin: string,
	input?: {
		admissionId: string;
		requestId: string;
		purchaseFingerprint: string;
	}
): Promise<{ id: string; clientSecret: string }> {
	const stripe = getStripe();

	const metadata = input
		? buildCheckoutAdmissionMetadata({
				admissionId: input.admissionId,
				requestId: input.requestId,
				purchaseFingerprint: input.purchaseFingerprint
			})
		: undefined;
	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		payment_method_types: ['card'],
		line_items: priceIds.map((priceId) => ({
			price: priceId,
			quantity: 1
		})),
		mode: 'subscription',
		ui_mode: 'embedded',
		return_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
		client_reference_id: input?.admissionId ?? clientReferenceId,
		...(metadata ? { metadata } : {}),
		allow_promotion_codes: true,
		subscription_data: metadata ? { trial_period_days: 14, metadata } : { trial_period_days: 14 }
	};

	// Add customer info
	if (customerId) {
		sessionParams.customer = customerId;
	} else if (customerEmail) {
		sessionParams.customer_email = customerEmail;
	}

	const session = await stripe.checkout.sessions.create(
		sessionParams,
		input ? { idempotencyKey: input.admissionId } : undefined
	);
	if (!session.client_secret) {
		throw new Error('Stripe Checkout session did not return a client secret');
	}
	return { id: session.id, clientSecret: session.client_secret };
}

export function isDefinitiveCheckoutCreationFailure(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const type = (error as { type?: unknown }).type;
	return (
		type === 'StripeInvalidRequestError' ||
		type === 'StripeAuthenticationError' ||
		type === 'StripePermissionError'
	);
}
