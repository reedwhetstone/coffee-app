import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getStripe } from './stripe';

interface RoleAuditLog {
	user_id: string;
	old_role: string | null;
	new_role: string;
	trigger_type: 'checkout_success' | 'webhook_processing' | 'manual_verification' | 'admin_change';
	stripe_customer_id?: string;
	stripe_subscription_id?: string;
	session_id?: string;
	metadata?: Record<string, any>;
}

/**
 * Log role changes for audit trail
 */
async function logRoleChange(supabase: any, auditData: RoleAuditLog) {
	try {
		const { error } = await supabase
			.from('role_audit_logs')
			.insert({
				...auditData,
				created_at: new Date().toISOString()
			});
		
		if (error) {
			console.error('❌ Failed to log role change:', error);
		} else {
			console.log('📝 Role change logged:', auditData.user_id, auditData.old_role, '→', auditData.new_role);
		}
	} catch (err) {
		console.error('❌ Error logging role change:', err);
	}
}

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

	// Get current role for audit logging
	const { data: currentRoleData } = await supabase
		.from('user_roles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();

	const currentRole = currentRoleData?.role || null;

	// Only update if role is different to avoid unnecessary operations
	if (currentRole !== 'member') {
		// Update user role to 'member'
		const { error } = await supabase
			.from('user_roles')
			.upsert({ 
				id: userId, 
				role: 'member',
				updated_at: new Date().toISOString()
			}, { onConflict: 'id' });

		if (error) {
			console.error('❌ Error updating user role:', error);
		} else {
			console.log(`✅ Updated user ${userId} to member role`);
			
			// Log the role change
			await logRoleChange(supabase, {
				user_id: userId,
				old_role: currentRole,
				new_role: 'member',
				trigger_type: 'webhook_processing',
				stripe_customer_id: customerId,
				stripe_subscription_id: subscription.id,
				metadata: {
					subscription_status: subscription.status,
					webhook_event: 'subscription_active',
					subscription_created: subscription.created,
					subscription_current_period_end: subscription.current_period_end
				}
			});
		}
	} else {
		console.log(`ℹ️ User ${userId} already has member role, no update needed`);
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

	// Get current role for audit logging
	const { data: currentRoleData } = await supabase
		.from('user_roles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();

	const currentRole = currentRoleData?.role || null;

	// Only update if role is different to avoid unnecessary operations
	if (currentRole !== 'viewer') {
		// Update user role to 'viewer'
		const { error } = await supabase
			.from('user_roles')
			.upsert({ 
				id: userId, 
				role: 'viewer',
				updated_at: new Date().toISOString()
			}, { onConflict: 'id' });

		if (error) {
			console.error('❌ Error updating user role:', error);
		} else {
			console.log(`✅ Updated user ${userId} to viewer role`);
			
			// Log the role change
			await logRoleChange(supabase, {
				user_id: userId,
				old_role: currentRole,
				new_role: 'viewer',
				trigger_type: 'webhook_processing',
				stripe_customer_id: customerId,
				stripe_subscription_id: subscription.id,
				metadata: {
					subscription_status: subscription.status,
					webhook_event: 'subscription_inactive',
					subscription_created: subscription.created,
					subscription_ended_at: subscription.ended_at || subscription.canceled_at,
					cancel_reason: subscription.cancellation_details?.reason
				}
			});
		}
	} else {
		console.log(`ℹ️ User ${userId} already has viewer role, no update needed`);
	}
}
