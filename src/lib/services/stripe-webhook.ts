import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { createAdminClient } from '$lib/supabase-admin';
import {
	reconcileStripeSubscriptionEntitlements,
	type ResolvedBillingEntitlements
} from '$lib/server/billing/entitlements';
import type { Database, Json } from '$lib/types/database.types';

import { getStripe } from './stripe';

interface RoleAuditLog {
	user_id: string;
	old_role: string | null;
	new_role: string;
	trigger_type: 'checkout_success' | 'webhook_processing' | 'manual_verification' | 'admin_change';
	stripe_customer_id?: string;
	stripe_subscription_id?: string;
	session_id?: string;
	metadata?: Json;
}

function serializeEntitlements(entitlements: ResolvedBillingEntitlements): Json {
	return {
		role: entitlements.role,
		apiPlan: entitlements.apiPlan,
		ppiAccess: entitlements.ppiAccess
	};
}

/**
 * Log entitlement changes for audit trail.
 */
async function logRoleChange(supabase: SupabaseClient<Database>, auditData: RoleAuditLog) {
	try {
		const { error } = await supabase.from('role_audit_logs').insert({
			...auditData,
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('Failed to persist Stripe role-change audit');
		}
	} catch {
		console.error('Failed to persist Stripe role-change audit');
	}
}

/**
 * Create Supabase admin client that bypasses RLS for webhook operations.
 */
export function createAdminSupabase(): SupabaseClient<Database> {
	return createAdminClient() as SupabaseClient<Database>;
}

/**
 * Verify and construct a Stripe event from webhook data.
 */
export async function constructStripeEvent(
	body: string,
	signature: string,
	webhookSecret: string
): Promise<Stripe.Event | null> {
	try {
		const stripe = getStripe();
		return stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch {
		console.error('Stripe webhook signature verification failed');
		return null;
	}
}

async function resolveUserIdForStripeCustomer(
	customerId: string,
	supabase: SupabaseClient<Database>
): Promise<{ userId: string | null; email: string | null }> {
	const { data: customerData, error: customerLookupError } = await supabase
		.from('stripe_customers')
		.select('user_id, email')
		.eq('customer_id', customerId)
		.maybeSingle();

	if (customerLookupError) {
		throw new Error('Stripe customer mapping is unavailable');
	}

	if (customerData?.user_id) {
		return {
			userId: customerData.user_id,
			email: customerData.email ?? null
		};
	}

	try {
		const stripe = getStripe();
		const customer = await stripe.customers.retrieve(customerId);

		if (customer && !('deleted' in customer) && customer.metadata?.supabaseUserId) {
			const userId = customer.metadata.supabaseUserId;

			const { error: upsertError } = await supabase.from('stripe_customers').upsert(
				{
					user_id: userId,
					customer_id: customerId,
					email: customer.email || null,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'user_id' }
			);

			if (upsertError) throw new Error('Stripe customer mapping could not be persisted');

			return {
				userId,
				email: customer.email || null
			};
		}
	} catch {
		throw new Error('Stripe customer ownership could not be resolved');
	}

	return { userId: null, email: null };
}

/**
 * Upsert the local billing snapshot for a Stripe subscription and recompute canonical entitlements.
 */
export async function reconcileStripeSubscription(
	subscription: Stripe.Subscription,
	supabase: SupabaseClient<Database>,
	verifiedOwnerId?: string
) {
	const customerId =
		typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

	let userId = verifiedOwnerId ?? null;
	if (userId) {
		const customer = typeof subscription.customer === 'string' ? null : subscription.customer;
		const { error } = await supabase.from('stripe_customers').upsert(
			{
				user_id: userId,
				customer_id: customerId,
				email: customer && !('deleted' in customer) ? customer.email : null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);
		if (error) throw new Error('Stripe customer mapping could not be persisted');
	} else {
		({ userId } = await resolveUserIdForStripeCustomer(customerId, supabase));
	}
	if (!userId) {
		console.info('Stripe subscription has no managed account owner');
		return;
	}

	const reconciliation = await reconcileStripeSubscriptionEntitlements(supabase, {
		userId,
		stripeCustomerId: customerId,
		subscription
	});

	if (reconciliation.unknownPriceIds.length > 0) {
		console.warn('Stripe billing reconciliation ignored unknown price identifiers');
	}

	if (reconciliation.deletedItemIds.length > 0) {
		console.info('Stripe billing reconciliation removed stale snapshot items');
	}

	if (!reconciliation.changed) {
		return;
	}

	await logRoleChange(supabase, {
		user_id: userId,
		old_role: reconciliation.previousEntitlements.role,
		new_role: reconciliation.resolvedEntitlements.role,
		trigger_type: 'webhook_processing',
		stripe_customer_id: customerId,
		stripe_subscription_id: subscription.id,
		metadata: {
			subscription_status: subscription.status,
			cancel_at_period_end: subscription.cancel_at_period_end,
			current_period_end: subscription.current_period_end,
			previous_entitlements: serializeEntitlements(reconciliation.previousEntitlements),
			resolved_entitlements: serializeEntitlements(reconciliation.resolvedEntitlements),
			billing_subscriptions: reconciliation.subscriptions.map((row) => ({
				stripe_subscription_id: row.stripe_subscription_id,
				stripe_price_id: row.stripe_price_id,
				product_family: row.product_family,
				product_key: row.product_key,
				status: row.status
			})),
			unknown_price_ids: reconciliation.unknownPriceIds
		}
	});
}
