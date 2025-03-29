import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getStripe } from './stripe';

/**
 * Create Supabase admin client that bypasses RLS for webhook operations
 */
export function createAdminSupabase() {
	return createAdminClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}

/**
 * Verify and construct a Stripe event from webhook data
 */
export async function constructStripeEvent(
	body: string,
	signature: string,
	webhookSecret: string
): Promise<Stripe.Event | null> {
	try {
		const stripe = getStripe();
		return stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err) {
		console.error('❌ Webhook signature verification failed:', err);
		return null;
	}
}

/**
 * Handle subscription activation (new or updated)
 */
export async function handleSubscriptionActive(subscription: Stripe.Subscription, supabase: any) {
	const customerId =
		typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

	console.log('🔍 Looking up user for Stripe customer:', customerId);

	// Look up existing mapping
	const { data: customerData } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	let userId = customerData?.user_id;

	// If no user mapping found, try getting from Stripe metadata
	if (!userId) {
		try {
			const stripe = getStripe();
			const customer = await stripe.customers.retrieve(customerId);

			if (customer && !('deleted' in customer) && customer.metadata?.supabaseUserId) {
				userId = customer.metadata.supabaseUserId;
				console.log('✅ Found user ID in Stripe metadata:', userId);

				// Create the mapping in our database
				await supabase.from('stripe_customers').upsert({
					user_id: userId,
					customer_id: customerId,
					email: customer.email || null
				});
			}
		} catch (err) {
			console.error('❌ Error retrieving customer from Stripe:', err);
			return;
		}
	}

	if (!userId) {
		console.error('❌ Could not determine user ID for customer:', customerId);
		return;
	}

	// Update user role to 'member'
	const { error } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'member' }, { onConflict: 'id' });

	if (error) {
		console.error('❌ Error updating user role:', error);
	} else {
		console.log(`✅ Updated user ${userId} to member role`);
	}
}

/**
 * Handle subscription deactivation (canceled, unpaid, etc.)
 */
export async function handleSubscriptionInactive(subscription: Stripe.Subscription, supabase: any) {
	const customerId =
		typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

	console.log('🔍 Looking up user for inactive subscription:', customerId);

	// Look up existing mapping
	const { data: customerData } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	let userId = customerData?.user_id;

	// If no user mapping found, try getting from Stripe metadata
	if (!userId) {
		try {
			const stripe = getStripe();
			const customer = await stripe.customers.retrieve(customerId);

			if (customer && !('deleted' in customer) && customer.metadata?.supabaseUserId) {
				userId = customer.metadata.supabaseUserId;
				console.log('✅ Found user ID in Stripe metadata:', userId);

				// Create the mapping in our database
				await supabase.from('stripe_customers').upsert({
					user_id: userId,
					customer_id: customerId,
					email: customer.email || null
				});
			}
		} catch (err) {
			console.error('❌ Error retrieving customer from Stripe:', err);
			return;
		}
	}

	if (!userId) {
		console.error('❌ Could not determine user ID for customer:', customerId);
		return;
	}

	// Update user role to 'viewer'
	const { error } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'viewer' }, { onConflict: 'id' });

	if (error) {
		console.error('❌ Error updating user role:', error);
	} else {
		console.log(`✅ Updated user ${userId} to viewer role`);
	}
}
