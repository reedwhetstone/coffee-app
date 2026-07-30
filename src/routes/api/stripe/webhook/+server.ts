import { json } from '@sveltejs/kit';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import type { RequestEvent } from '@sveltejs/kit';

import {
	constructStripeEvent,
	createAdminSupabase,
	reconcileStripeSubscription
} from '$lib/services/stripe-webhook';
import { getStripe } from '$lib/services/stripe';
import {
	checkoutAdmissionContextFromMetadata,
	checkoutAdmissionsEnabled,
	checkoutProviderIsEligible,
	CheckoutAdmissionError,
	legacyCheckoutDrainEnabled,
	terminalizeExpiredCheckoutAdmission,
	type CheckoutAdmissionContext
} from '$lib/server/billing/checkoutAdmissions';

async function requireProviderEligibility(
	event: RequestEvent,
	context: CheckoutAdmissionContext | null
): Promise<boolean> {
	// Managed sessions stay fenced even if the creation rollout is disabled
	// during rollback or configuration drift. The flag only controls whether
	// metadata-free legacy sessions remain admissible during the drain.
	if (context) return checkoutProviderIsEligible(event, context);
	return !checkoutAdmissionsEnabled() || legacyCheckoutDrainEnabled();
}

export async function POST(requestEvent: RequestEvent) {
	const { request } = requestEvent;
	console.log('🔔 Webhook endpoint called');

	const supabase = createAdminSupabase();
	console.log('📊 Using service role client for database operations');

	const signature = request.headers.get('stripe-signature');
	console.log('🔑 Stripe signature present:', !!signature);

	if (!signature) {
		console.error('❌ No Stripe signature found in request');
		return json({ error: 'No signature' }, { status: 400 });
	}

	try {
		const body = await request.text();
		console.log('📦 Webhook body length:', body.length);
		console.log('📦 Webhook body preview:', body.substring(0, 200) + '...');

		if (!body) {
			console.error('❌ Empty request body');
			return json({ error: 'Empty body' }, { status: 400 });
		}

		const stripeEvent = await constructStripeEvent(body, signature, STRIPE_WEBHOOK_SECRET);
		if (!stripeEvent) {
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		console.log('✅ Webhook signature verified successfully');
		console.log(`📣 Received Stripe event: ${stripeEvent.type}`);
		console.log(
			'📊 Event data:',
			JSON.stringify(stripeEvent.data.object).substring(0, 200) + '...'
		);

		switch (stripeEvent.type) {
			case 'checkout.session.completed': {
				const session = stripeEvent.data.object;
				console.log('💰 Checkout session completed');
				console.log('🧑 Customer ID:', session.customer);
				console.log('📝 Subscription ID:', session.subscription);

				const admissionContext = checkoutAdmissionContextFromMetadata(session.metadata, session.id);
				if (!(await requireProviderEligibility(requestEvent, admissionContext))) {
					console.warn('Checkout provider writes rejected by Parchment admission fence');
					break;
				}

				if (session.client_reference_id && session.customer) {
					console.log('🔑 Client reference ID found:', session.client_reference_id);

					try {
						const stripe = getStripe();
						const customerId =
							typeof session.customer === 'string' ? session.customer : session.customer.id;

						await stripe.customers.update(customerId, {
							metadata: {
								supabaseUserId: session.client_reference_id
							}
						});
						console.log('✅ Updated customer metadata with user ID');
					} catch (err) {
						console.error('❌ Error updating customer metadata:', err);
					}
				}

				if (session.mode === 'subscription' && session.subscription) {
					console.log('✅ Subscription created in checkout, retrieving details');
					try {
						const stripe = getStripe();
						const subscriptionId =
							typeof session.subscription === 'string'
								? session.subscription
								: session.subscription.id;

						const subscription = await stripe.subscriptions.retrieve(subscriptionId);
						await reconcileStripeSubscription(subscription, supabase);
					} catch (err) {
						console.error('❌ Error retrieving subscription details:', err);
					}
				}
				break;
			}

			case 'checkout.session.expired': {
				const session = stripeEvent.data.object;
				const admissionContext = checkoutAdmissionContextFromMetadata(session.metadata, session.id);
				if (admissionContext) {
					try {
						await terminalizeExpiredCheckoutAdmission(requestEvent, admissionContext);
					} catch (error) {
						if (!(error instanceof CheckoutAdmissionError && error.status === 409)) throw error;
						console.info('Account deletion owns expired Checkout reconciliation');
					}
				}
				break;
			}

			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted': {
				const subscription = stripeEvent.data.object;
				let admissionContext: CheckoutAdmissionContext | null = null;
				const ownerId = subscription.metadata?.supabase_user_id;
				const admissionId = subscription.metadata?.parchment_admission_id;
				const requestId = subscription.metadata?.checkout_request_id;
				const hasManagedAdmissionMetadata = Boolean(ownerId || admissionId || requestId);
				if (hasManagedAdmissionMetadata && (!ownerId || !admissionId)) {
					throw new Error('Managed subscription is missing Checkout admission metadata');
				}
				if (ownerId && admissionId) {
					const stripe = getStripe();
					const sessions = await stripe.checkout.sessions.list({
						subscription: subscription.id,
						limit: 1
					});
					const checkoutSession = sessions.data[0];
					if (!checkoutSession) {
						throw new Error('Managed subscription Checkout session could not be resolved');
					}
					admissionContext = {
						ownerId,
						admissionId,
						requestId,
						stripeSessionId: checkoutSession.id
					};
				}
				// Historical subscriptions predate the one-time Checkout admission
				// protocol and remain reconcilable for their full lifetime. The
				// legacy drain flag applies only to outstanding checkout.session
				// events during cutover, never to ordinary subscription maintenance.
				if (
					!admissionContext ||
					(await checkoutProviderIsEligible(requestEvent, admissionContext))
				) {
					await reconcileStripeSubscription(subscription, supabase);
				} else {
					console.warn('Subscription provider writes rejected by Parchment admission fence');
				}
				break;
			}

			default:
				console.log(`⚠️ Unhandled event type: ${stripeEvent.type}`);
		}

		console.log('✅ Webhook processing completed successfully');
		return json({ received: true });
	} catch (err) {
		console.error('❌ Error processing webhook:', err);
		return json({ error: 'Webhook error' }, { status: 400 });
	}
}
