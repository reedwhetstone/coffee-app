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
 * Helper function to manage role arrays for subscription changes
 */
function updateRoleArray(
	currentRoles: string[],
	roleToAdd: string,
	roleToRemove?: string[]
): string[] {
	let updatedRoles = [...currentRoles];

	// Remove old roles if specified
	if (roleToRemove) {
		updatedRoles = updatedRoles.filter((role) => !roleToRemove.includes(role));
	}

	// Add new role if not already present
	if (!updatedRoles.includes(roleToAdd)) {
		updatedRoles.push(roleToAdd);
	}

	// Handle base tier mutual exclusivity: viewer and member cannot coexist
	if (roleToAdd === 'member' && updatedRoles.includes('viewer')) {
		updatedRoles = updatedRoles.filter((role) => role !== 'viewer');
	}
	if (roleToAdd === 'viewer' && updatedRoles.includes('member')) {
		updatedRoles = updatedRoles.filter((role) => role !== 'member');
	}

	return updatedRoles;
}

/**
 * Log role changes for audit trail
 */
async function logRoleChange(supabase: any, auditData: RoleAuditLog) {
	try {
		const { error } = await supabase.from('role_audit_logs').insert({
			...auditData,
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('❌ Failed to log role change:', error);
		} else {
			console.log(
				'📝 Role change logged:',
				auditData.user_id,
				auditData.old_role,
				'→',
				auditData.new_role
			);
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

	// Get current roles for audit logging
	const { data: currentRoleData } = await supabase
		.from('user_roles')
		.select('user_role')
		.eq('id', userId)
		.maybeSingle();

	const currentRoles = currentRoleData?.user_role || ['viewer'];
	const currentRole = Array.isArray(currentRoles) ? currentRoles[0] : currentRoles;

	// Only update if user doesn't already have member role
	if (!currentRoles.includes('member')) {
		// Update user role array to include 'member'
		const updatedRoles = updateRoleArray(currentRoles, 'member');
		const { error } = await supabase.from('user_roles').upsert(
			{
				id: userId,
				user_role: updatedRoles,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'id' }
		);

		if (error) {
			console.error('❌ Error updating user role:', error);
		} else {
			console.log(`✅ Updated user ${userId} roles to include member:`, updatedRoles);

			// Log the role change
			await logRoleChange(supabase, {
				user_id: userId,
				old_role: currentRoles.join(','),
				new_role: updatedRoles.join(','),
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

	// Get current roles for audit logging
	const { data: currentRoleData } = await supabase
		.from('user_roles')
		.select('user_role')
		.eq('id', userId)
		.maybeSingle();

	const currentRoles = currentRoleData?.user_role || ['viewer'];
	const currentRole = Array.isArray(currentRoles) ? currentRoles[0] : currentRoles;

	// Remove member role and set to viewer (handles downgrade)
	if (currentRoles.includes('member')) {
		// Remove member role, keep API roles if present, otherwise default to viewer
		let updatedRoles = currentRoles.filter((role: string) => role !== 'member');
		if (updatedRoles.length === 0 || (updatedRoles.length === 1 && updatedRoles[0] === 'viewer')) {
			updatedRoles = ['viewer'];
		}
		const { error } = await supabase.from('user_roles').upsert(
			{
				id: userId,
				user_role: updatedRoles,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'id' }
		);

		if (error) {
			console.error('❌ Error updating user role:', error);
		} else {
			console.log(`✅ Updated user ${userId} roles after member cancellation:`, updatedRoles);

			// Log the role change
			await logRoleChange(supabase, {
				user_id: userId,
				old_role: currentRoles.join(','),
				new_role: updatedRoles.join(','),
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
		console.log(`ℹ️ User ${userId} doesn't have member role, no update needed`);
	}
}
