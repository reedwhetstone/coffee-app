import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/services/stripe';
import { createAdminClient } from '$lib/supabase-admin';

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

export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = createAdminClient();
	let sessionId: string | null = null;

	try {
		// Verify that the user is authenticated
		const { session, user } = await locals.safeGetSession();
		if (!session?.user || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		sessionId = body.sessionId;

		if (!sessionId) {
			return json({ error: 'Missing session_id parameter' }, { status: 400 });
		}

		console.log('🔍 Starting role verification for session:', sessionId, 'user:', user.id);

		// Check for existing processing to ensure idempotency
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

		// Mark as processing to prevent duplicate processing
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

		// Get Stripe instance and retrieve the Checkout Session
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

		// Only proceed if the session is complete and paid
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

		// Verify this session belongs to the current user
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

		console.log('👤 Processing role update for user:', user.id, 'Customer:', customerId);

		// Get current role for audit logging
		const { data: currentRoleData } = await supabase
			.from('user_roles')
			.select('role')
			.eq('id', user.id)
			.maybeSingle();

		const currentRole = currentRoleData?.role || null;

		// Ensure customer mapping exists
		await supabase.from('stripe_customers').upsert(
			{
				user_id: user.id,
				customer_id: customerId,
				email: user.email || checkoutSession.customer_details?.email || null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		// Check if there's a subscription and if it's active or trialing
		let shouldHaveMemberRole = false;
		let subscriptionId = null;
		let subscriptionStatus = 'none';

		if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
			subscriptionId =
				typeof checkoutSession.subscription === 'string'
					? checkoutSession.subscription
					: checkoutSession.subscription.id;

			const subscription = await stripe.subscriptions.retrieve(subscriptionId);
			subscriptionStatus = subscription.status;
			console.log('📋 Subscription status:', subscription.status);

			if (subscription.status === 'active' || subscription.status === 'trialing') {
				shouldHaveMemberRole = true;
			}
		}

		let roleUpdated = false;

		// Update user role to member if they should have it and don't already have it
		if (shouldHaveMemberRole && currentRole !== 'member') {
			const { error: roleError } = await supabase.from('user_roles').upsert(
				{
					id: user.id,
					role: 'member',
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			);

			if (roleError) {
				console.error('❌ Error updating user role:', roleError);

				await supabase
					.from('stripe_session_processing')
					.update({
						status: 'failed',
						error_message: `Role update failed: ${roleError.message}`,
						completed_at: new Date().toISOString()
					})
					.eq('session_id', sessionId)
					.eq('user_id', user.id);

				return json({ error: 'Failed to update user role' }, { status: 500 });
			}

			// Log the role change
			await logRoleChange(supabase, {
				user_id: user.id,
				old_role: currentRole,
				new_role: 'member',
				trigger_type: 'checkout_success',
				stripe_customer_id: customerId || undefined,
				stripe_subscription_id: subscriptionId || undefined,
				session_id: sessionId || undefined,
				metadata: {
					subscription_status: subscriptionStatus,
					payment_amount: checkoutSession.amount_total,
					currency: checkoutSession.currency,
					checkout_mode: checkoutSession.mode
				}
			});

			console.log(`✅ Updated user ${user.id} to member role`);
			roleUpdated = true;
		}

		// Mark processing as completed
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
				message: 'Role successfully updated to member'
			});
		} else if (shouldHaveMemberRole && currentRole === 'member') {
			return json({
				success: true,
				roleUpdated: false,
				message: 'User already has member role'
			});
		} else {
			console.log('ℹ️ No role update needed - no active subscription found');
			return json({
				success: true,
				roleUpdated: false,
				message: 'Payment verified but no active subscription found'
			});
		}
	} catch (error: any) {
		console.error('❌ Error verifying session and updating role:', error);

		// Mark processing as failed if we have sessionId and it's not a parsing error
		if (sessionId) {
			try {
				await supabase
					.from('stripe_session_processing')
					.update({
						status: 'failed',
						error_message: error.message,
						completed_at: new Date().toISOString()
					})
					.eq('session_id', sessionId);
			} catch (updateError) {
				console.error('❌ Failed to update processing status:', updateError);
			}
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};
