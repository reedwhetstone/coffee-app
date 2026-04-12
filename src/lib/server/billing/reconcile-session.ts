import { json, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { getStripe } from '$lib/services/stripe';
import { createAdminClient } from '$lib/supabase-admin';
import type { Database, Json } from '$lib/types/database.types';

import {
	reconcileStripeSubscriptionEntitlements,
	resolveStoredBillingEntitlements,
	type ResolvedBillingEntitlements
} from './entitlements';

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
		}
	} catch (error) {
		console.error('❌ Error logging role change:', error);
	}
}

async function loadCurrentEntitlements(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<Json | null> {
	const { data, error } = await supabase
		.from('user_roles')
		.select('role, user_role, api_plan, ppi_access')
		.eq('id', userId)
		.maybeSingle();

	if (error) {
		console.error('❌ Failed to load current entitlements:', error);
		return null;
	}

	return serializeEntitlements(resolveStoredBillingEntitlements(data));
}

async function markSessionProcessingStatus(
	supabase: SupabaseClient<Database>,
	input: {
		sessionId: string;
		userId: string;
		status: 'processing' | 'completed' | 'failed';
		roleUpdated?: boolean;
		errorMessage?: string;
	}
) {
	const payload: Database['public']['Tables']['stripe_session_processing']['Update'] = {
		status: input.status,
		completed_at: input.status === 'processing' ? null : new Date().toISOString()
	};

	if (typeof input.roleUpdated === 'boolean') {
		payload.role_updated = input.roleUpdated;
	}

	if (typeof input.errorMessage === 'string') {
		payload.error_message = input.errorMessage;
	}

	if (input.status === 'processing') {
		payload.started_at = new Date().toISOString();
		payload.completed_at = null;
		payload.error_message = null;
	}

	await supabase
		.from('stripe_session_processing')
		.update(payload)
		.eq('session_id', input.sessionId)
		.eq('user_id', input.userId);
}

async function upsertSessionProcessingRow(
	supabase: SupabaseClient<Database>,
	sessionId: string,
	userId: string
) {
	const { error } = await supabase.from('stripe_session_processing').upsert(
		{
			session_id: sessionId,
			user_id: userId,
			status: 'processing',
			started_at: new Date().toISOString(),
			completed_at: null,
			error_message: null
		},
		{ onConflict: 'session_id,user_id' }
	);

	if (error) {
		throw new Error(`Failed to mark checkout session as processing: ${error.message}`);
	}
}

async function persistStripeCustomer(
	supabase: SupabaseClient<Database>,
	input: {
		user: User;
		customerId: string;
		checkoutEmail: string | null;
	}
) {
	const { error } = await supabase.from('stripe_customers').upsert(
		{
			user_id: input.user.id,
			customer_id: input.customerId,
			email: input.user.email || input.checkoutEmail,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);

	if (error) {
		throw new Error(`Failed to persist Stripe customer mapping: ${error.message}`);
	}
}

export async function handleReconcileStripeSession(event: RequestEvent) {
	const supabase = createAdminClient() as SupabaseClient<Database>;
	let sessionId: string | null = null;
	let userId: string | null = null;

	try {
		const { session, user } = await event.locals.safeGetSession();
		if (!session?.user || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		userId = user.id;

		const body = await event.request.json();
		sessionId = body.sessionId ?? body.session_id ?? null;

		if (!sessionId) {
			return json({ error: 'Missing session_id parameter' }, { status: 400 });
		}

		const { data: existingProcessing, error: existingProcessingError } = await supabase
			.from('stripe_session_processing')
			.select('role_updated')
			.eq('session_id', sessionId)
			.eq('user_id', user.id)
			.eq('status', 'completed')
			.maybeSingle();

		if (existingProcessingError) {
			throw new Error(
				`Failed to load session processing state: ${existingProcessingError.message}`
			);
		}

		if (existingProcessing) {
			return json({
				success: true,
				entitlementsChanged: existingProcessing.role_updated || false,
				roleUpdated: existingProcessing.role_updated || false,
				message: 'Checkout session already reconciled',
				alreadyProcessed: true,
				entitlements: await loadCurrentEntitlements(supabase, user.id)
			});
		}

		await upsertSessionProcessingRow(supabase, sessionId, user.id);

		const stripe = getStripe();
		const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['subscription']
		});

		if (checkoutSession.status !== 'complete' || checkoutSession.payment_status !== 'paid') {
			await markSessionProcessingStatus(supabase, {
				sessionId,
				userId: user.id,
				status: 'failed',
				errorMessage: `Payment not complete: ${checkoutSession.status}/${checkoutSession.payment_status}`
			});

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
			await markSessionProcessingStatus(supabase, {
				sessionId,
				userId: user.id,
				status: 'failed',
				errorMessage: 'Session user mismatch'
			});

			return json({ error: 'Session user mismatch' }, { status: 403 });
		}

		const customerId =
			typeof checkoutSession.customer === 'string'
				? checkoutSession.customer
				: checkoutSession.customer?.id;

		if (!customerId) {
			await markSessionProcessingStatus(supabase, {
				sessionId,
				userId: user.id,
				status: 'failed',
				errorMessage: 'No customer ID found in session'
			});

			return json({ error: 'No customer ID found in session' }, { status: 400 });
		}

		await persistStripeCustomer(supabase, {
			user,
			customerId,
			checkoutEmail: checkoutSession.customer_details?.email ?? null
		});

		let entitlementsChanged = false;
		let resolvedEntitlements: Json | null = await loadCurrentEntitlements(supabase, user.id);
		let subscriptionId: string | null = null;

		if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
			subscriptionId =
				typeof checkoutSession.subscription === 'string'
					? checkoutSession.subscription
					: checkoutSession.subscription.id;

			const subscription = await stripe.subscriptions.retrieve(subscriptionId);
			const reconciliation = await reconcileStripeSubscriptionEntitlements(supabase, {
				userId: user.id,
				stripeCustomerId: customerId,
				subscription
			});

			entitlementsChanged = reconciliation.changed;
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
						subscription_status: subscription.status,
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

		await markSessionProcessingStatus(supabase, {
			sessionId,
			userId: user.id,
			status: 'completed',
			roleUpdated: entitlementsChanged
		});

		return json({
			success: true,
			entitlementsChanged,
			roleUpdated: entitlementsChanged,
			message:
				checkoutSession.mode === 'subscription'
					? entitlementsChanged
						? 'Checkout session reconciled and entitlements updated'
						: 'Checkout session reconciled and entitlements were already up to date'
					: 'Checkout session verified, no subscription entitlements were updated',
			entitlements: resolvedEntitlements,
			subscriptionId,
			sessionId
		});
	} catch (error) {
		console.error('❌ Error reconciling checkout session:', error);

		if (sessionId && userId) {
			try {
				await markSessionProcessingStatus(supabase, {
					sessionId,
					userId,
					status: 'failed',
					errorMessage: error instanceof Error ? error.message : 'Unknown error'
				});
			} catch (updateError) {
				console.error('❌ Failed to update processing status:', updateError);
			}
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
}
