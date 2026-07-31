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
	CHECKOUT_ADMISSION_METADATA,
	CheckoutAdmissionError,
	legacyCheckoutDrainEnabled,
	terminalizeExpiredCheckoutAdmission,
	type CheckoutAdmissionContext
} from '$lib/server/billing/checkoutAdmissions';

interface ProviderEligibility {
	eligible: boolean;
	ownerId: string | null;
}

async function requireProviderEligibility(
	event: RequestEvent,
	context: CheckoutAdmissionContext | null
): Promise<ProviderEligibility> {
	// Managed sessions remain fenced through Parchment even if a rollout flag
	// drifts. Metadata-free sessions are accepted only during the explicit
	// legacy drain.
	if (context) return checkoutProviderIsEligible(event, context);
	return {
		eligible: !checkoutAdmissionsEnabled() || legacyCheckoutDrainEnabled(),
		ownerId: null
	};
}

function stripeObjectId(value: string | { id: string } | null): string | null {
	return typeof value === 'string' ? value : (value?.id ?? null);
}

async function managedSubscriptionContext(
	event: RequestEvent,
	subscriptionId: string,
	metadata: Record<string, string>
): Promise<{ context: CheckoutAdmissionContext; eligibility: ProviderEligibility } | null> {
	const admissionId = metadata[CHECKOUT_ADMISSION_METADATA.admissionId];
	const requestId = metadata[CHECKOUT_ADMISSION_METADATA.requestId];
	const purchaseFingerprint = metadata[CHECKOUT_ADMISSION_METADATA.purchaseFingerprint];
	const hasManagedMetadata = Boolean(admissionId || requestId || purchaseFingerprint);
	if (!hasManagedMetadata) return null;
	if (!admissionId) {
		throw new Error('Managed subscription is missing Checkout admission metadata');
	}

	const stripe = getStripe();
	const sessions = await stripe.checkout.sessions.list({
		subscription: subscriptionId,
		limit: 10
	});
	const checkoutSession = sessions.data.find(
		(session) => session.metadata?.[CHECKOUT_ADMISSION_METADATA.admissionId] === admissionId
	);
	if (!checkoutSession) {
		throw new Error('Managed subscription Checkout session could not be resolved');
	}
	const context = checkoutAdmissionContextFromMetadata(metadata, checkoutSession.id);
	if (!context) throw new Error('Managed subscription admission context is invalid');
	return {
		context,
		eligibility: await checkoutProviderIsEligible(event, context)
	};
}

export async function POST(requestEvent: RequestEvent) {
	const { request } = requestEvent;
	const signature = request.headers.get('stripe-signature');
	if (!signature) return json({ error: 'No signature' }, { status: 400 });

	try {
		const body = await request.text();
		if (!body) return json({ error: 'Empty body' }, { status: 400 });

		const stripeEvent = await constructStripeEvent(body, signature, STRIPE_WEBHOOK_SECRET);
		if (!stripeEvent) return json({ error: 'Invalid signature' }, { status: 400 });

		const supabase = createAdminSupabase();
		console.info('Processing verified Stripe webhook', { type: stripeEvent.type });

		switch (stripeEvent.type) {
			case 'checkout.session.completed': {
				const session = stripeEvent.data.object;
				const context = checkoutAdmissionContextFromMetadata(session.metadata, session.id);
				const eligibility = await requireProviderEligibility(requestEvent, context);
				if (!eligibility.eligible) {
					console.warn('Stripe provider write rejected by the Checkout admission fence');
					break;
				}

				const ownerId = eligibility.ownerId ?? (context ? null : session.client_reference_id);
				if (context && !ownerId) {
					throw new Error('Managed Checkout ownership could not be resolved');
				}
				if (session.mode === 'subscription' && session.subscription) {
					const subscriptionId = stripeObjectId(session.subscription);
					if (!subscriptionId) throw new Error('Checkout subscription is missing');
					const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
						expand: ['customer']
					});
					await reconcileStripeSubscription(subscription, supabase, ownerId ?? undefined);
				}
				break;
			}

			case 'checkout.session.expired': {
				const session = stripeEvent.data.object;
				const context = checkoutAdmissionContextFromMetadata(session.metadata, session.id);
				if (context) {
					try {
						await terminalizeExpiredCheckoutAdmission(requestEvent, context);
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
				const managed = await managedSubscriptionContext(
					requestEvent,
					subscription.id,
					subscription.metadata
				);
				if (managed && !managed.eligibility.eligible) {
					console.warn('Stripe subscription write rejected by the Checkout admission fence');
					break;
				}
				if (managed && !managed.eligibility.ownerId) {
					throw new Error('Managed subscription ownership could not be resolved');
				}
				await reconcileStripeSubscription(
					subscription,
					supabase,
					managed?.eligibility.ownerId ?? undefined
				);
				break;
			}
		}

		return json({ received: true });
	} catch {
		// A verified event that failed processing must be retryable by Stripe.
		// Never include raw event data or provider identifiers in external logs.
		console.error('Stripe webhook processing failed');
		return json({ error: 'Webhook processing failed' }, { status: 500 });
	}
}
