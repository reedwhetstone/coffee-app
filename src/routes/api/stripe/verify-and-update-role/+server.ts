import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { reconcileStripeSubscriptionEntitlements } from '$lib/server/billing/entitlements';
import { getStripe } from '$lib/services/stripe';
import { createAdminClient } from '$lib/supabase-admin';
import type { Database, Json } from '$lib/types/database.types';

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

function serializeEntitlements(entitlements: {
	role: string;
	userRole: string[];
	apiPlan: string;
	ppiAccess: boolean;
}): Json {
	return {
		role: entitlements.role,
		userRole: entitlements.userRole,
		apiPlan: entitlements.apiPlan,
		ppiAccess: entitlements.ppiAccess
	};
}

async function logRoleChange(supabase: SupabaseClient<Database>, auditData: RoleAuditLog) {
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

export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = createAdminClient() as SupabaseClient<Database>;
	let sessionId: string | null = null;

	try {
		const { session, user } = await locals.safeGetSession();
		if (!session?.user || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		sessionId = body.sessionId;

		if (!sessionId) {
			return json({ error: 'Missing session_id parameter' }, { status: 400 });
		}

		console.log('🔍 Starting billing reconciliation for session:', sessionId, 'user:', user.id);

		const { data: existingProcessing } = await supabase
			.from('stripe_session_processing')
			.select('*')
			.eq('session_id', sessionId)
			.eq('user_id', user.id)
			.eq('status', 'completed')
			.maybeSingle();

		if (existingProcessing) {
			console.log('✅ Session already processed:', sessionId);
			return json({
				success: true,
				roleUpdated: existingProcessing.role_updated || false,
				message: 'Session already processed',
				alreadyProcessed: true
			});
		}

		const { error: processingError } = await supabase.from('stripe_session_processing').upsert(
			{
				session_id: sessionId,
				user_id: user.id,
				status: 'processing',
				started_at: new Date().toISOString()
			},
			{ onConflict: 'session_id,user_id' }
		);

		if (processingError) {
			console.error('❌ Error marking session as processing:', processingError);
			return json({ error: 'Database error' }, { status: 500 });
		}

		const stripe = getStripe();
		const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['subscription']
		});

		console.log(
			'📊 Session status:',
			checkoutSession.status,
			'Payment status:',
			checkoutSession.payment_status
		);

		if (checkoutSession.status !== 'complete' || checkoutSession.payment_status !== 'paid') {
			await supabase
				.from('stripe_session_processing')
				.update({
					status: 'failed',
					error_message: `Payment not complete: ${checkoutSession.status}/${checkoutSession.payment_status}`,
					completed_at: new Date().toISOString()
				})
				.eq('session_id', sessionId)
				.eq('user_id', user.id);

			return json(
				{
					error: 'Payment not complete',
					status: checkoutSession.status,
					paymentStatus: checkoutSession.payment_status
				},
				{ status: 400 }
			);
		}

		if (checkoutSession.client_reference_id !== user.id) {
			console.error('❌ Session user mismatch:', {
				sessionUserId: checkoutSession.client_reference_id,
				currentUserId: user.id
			});

			await supabase
				.from('stripe_session_processing')
				.update({
					status: 'failed',
					error_message: 'Session user mismatch',
					completed_at: new Date().toISOString()
				})
				.eq('session_id', sessionId)
				.eq('user_id', user.id);

			return json({ error: 'Session user mismatch' }, { status: 403 });
		}

		const customerId =
			typeof checkoutSession.customer === 'string'
				? checkoutSession.customer
				: checkoutSession.customer?.id;

		if (!customerId) {
			await supabase
				.from('stripe_session_processing')
				.update({
					status: 'failed',
					error_message: 'No customer ID found in session',
					completed_at: new Date().toISOString()
				})
				.eq('session_id', sessionId)
				.eq('user_id', user.id);

			return json({ error: 'No customer ID found in session' }, { status: 400 });
		}

		await supabase.from('stripe_customers').upsert(
			{
				user_id: user.id,
				customer_id: customerId,
				email: user.email || checkoutSession.customer_details?.email || null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		let roleUpdated = false;
		let subscriptionId: string | null = null;
		let subscriptionStatus = 'none';
		let resolvedEntitlements: Json | null = null;

		if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
			subscriptionId =
				typeof checkoutSession.subscription === 'string'
					? checkoutSession.subscription
					: checkoutSession.subscription.id;

			const subscription = await stripe.subscriptions.retrieve(subscriptionId);
			subscriptionStatus = subscription.status;
			console.log('📋 Subscription status:', subscription.status);

			const reconciliation = await reconcileStripeSubscriptionEntitlements(supabase, {
				userId: user.id,
				stripeCustomerId: customerId,
				subscription
			});

			roleUpdated = reconciliation.changed;
			resolvedEntitlements = serializeEntitlements(reconciliation.resolvedEntitlements);

			if (reconciliation.changed) {
				await logRoleChange(supabase, {
					user_id: user.id,
					old_role: reconciliation.previousEntitlements.userRole.join(','),
					new_role: reconciliation.resolvedEntitlements.userRole.join(','),
					trigger_type: 'checkout_success',
					stripe_customer_id: customerId,
					stripe_subscription_id: subscriptionId,
					session_id: sessionId,
					metadata: {
						subscription_status: subscriptionStatus,
						payment_amount: checkoutSession.amount_total,
						currency: checkoutSession.currency,
						checkout_mode: checkoutSession.mode,
						unknown_price_ids: reconciliation.unknownPriceIds,
						billing_subscriptions: reconciliation.subscriptions.map((row) => ({
							stripe_subscription_id: row.stripe_subscription_id,
							stripe_price_id: row.stripe_price_id,
							product_family: row.product_family,
							product_key: row.product_key,
							status: row.status
						})),
						previous_entitlements: serializeEntitlements(reconciliation.previousEntitlements),
						resolved_entitlements: serializeEntitlements(reconciliation.resolvedEntitlements)
					}
				});
			}
		}

		await supabase
			.from('stripe_session_processing')
			.update({
				status: 'completed',
				role_updated: roleUpdated,
				completed_at: new Date().toISOString()
			})
			.eq('session_id', sessionId)
			.eq('user_id', user.id);

		if (roleUpdated) {
			return json({
				success: true,
				roleUpdated: true,
				message: 'Billing entitlements successfully reconciled',
				entitlements: resolvedEntitlements
			});
		}

		return json({
			success: true,
			roleUpdated: false,
			message:
				checkoutSession.mode === 'subscription'
					? 'Payment verified and billing entitlements were already up to date'
					: 'Payment verified but no subscription entitlements were updated',
			entitlements: resolvedEntitlements
		});
	} catch (error) {
		console.error('❌ Error verifying session and updating role:', error);

		if (sessionId) {
			try {
				await supabase
					.from('stripe_session_processing')
					.update({
						status: 'failed',
						error_message: error instanceof Error ? error.message : 'Unknown error',
						completed_at: new Date().toISOString()
					})
					.eq('session_id', sessionId);
			} catch (updateError) {
				console.error('❌ Failed to update processing status:', updateError);
			}
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
