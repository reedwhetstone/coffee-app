import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createCheckoutSession,
	getStripe,
	getStripeCustomerId,
	isDefinitiveCheckoutCreationFailure
} from '$lib/services/stripe';
import { getBillingCatalogEntry, type BillingCatalogEntry } from '$lib/server/billing/catalog';
import { isCookieSessionPrincipal, isTrustedMutationRequest } from '$lib/server/principal';
import {
	abandonCheckoutAdmission,
	acquireCheckoutAdmission,
	checkoutPurchaseFingerprint,
	checkoutAdmissionsEnabled,
	CheckoutAdmissionError,
	normalizeCheckoutStripePriceIds,
	publishCheckoutAdmission,
	verifyPublishedCheckoutReplay
} from '$lib/server/billing/checkoutAdmissions';
import { ParchmentConfigError } from '$lib/server/parchmentClient';

type ExistingBillingSubscription = {
	product_family: string;
	product_key: string;
	status: string;
};

const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES = new Set([
	'active',
	'trialing',
	'past_due',
	'incomplete',
	'unpaid'
]);

function blocksSameFamilyCheckout(status: string): boolean {
	return CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES.has(status);
}

function normalizeRequestedPurchaseKeys(requestBody: unknown): string[] {
	if (!requestBody || typeof requestBody !== 'object') {
		return [];
	}

	const rawRequest = requestBody as {
		purchaseKey?: unknown;
		purchaseKeys?: unknown;
	};

	const rawPurchaseKeys = Array.isArray(rawRequest.purchaseKeys)
		? rawRequest.purchaseKeys
		: typeof rawRequest.purchaseKey === 'string'
			? [rawRequest.purchaseKey]
			: [];

	return Array.from(
		new Set(
			rawPurchaseKeys
				.filter((value): value is string => typeof value === 'string')
				.map((value) => value.trim())
				.filter(Boolean)
		)
	);
}

function getUnknownPurchaseKey(purchaseKeys: string[]): string | null {
	for (const purchaseKey of purchaseKeys) {
		if (!getBillingCatalogEntry(purchaseKey)) {
			return purchaseKey;
		}
	}

	return null;
}

function getRequestedCatalogEntries(purchaseKeys: string[]): BillingCatalogEntry[] {
	return purchaseKeys
		.map((purchaseKey) => getBillingCatalogEntry(purchaseKey))
		.filter((entry): entry is BillingCatalogEntry => entry !== null);
}

function getNonSelfServeCheckoutError(entry: BillingCatalogEntry): string {
	if (entry.billingKind === 'contact_sales') {
		return `${entry.publicPlanName} for ${entry.publicProductName} is not available through self-serve checkout. Contact sales.`;
	}

	if (entry.isDefaultFreeTier) {
		return `${entry.publicPlanName} is the default free tier for ${entry.publicProductName} and does not use checkout.`;
	}

	return `${entry.displayName} is not available through self-serve checkout.`;
}

function getInRequestFamilyConflict(entries: BillingCatalogEntry[]): BillingCatalogEntry | null {
	const seenFamilies = new Set<string>();

	for (const entry of entries) {
		if (seenFamilies.has(entry.productFamily)) {
			return entry;
		}

		seenFamilies.add(entry.productFamily);
	}

	return null;
}

function getExistingFamilyConflict(input: {
	requestedEntries: BillingCatalogEntry[];
	existingSubscriptions: ExistingBillingSubscription[];
}): BillingCatalogEntry | null {
	for (const entry of input.requestedEntries) {
		const hasActiveSameFamilySubscription = input.existingSubscriptions.some(
			(subscription) =>
				subscription.product_family === entry.productFamily &&
				blocksSameFamilyCheckout(subscription.status)
		);

		if (hasActiveSameFamilySubscription) {
			return entry;
		}
	}

	return null;
}

function normalizeRequestId(requestBody: unknown): string | null {
	if (!requestBody || typeof requestBody !== 'object') return null;
	const requestId = (requestBody as { requestId?: unknown }).requestId;
	return typeof requestId === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
		? requestId
		: null;
}

function admissionFailure(error: unknown) {
	if (error instanceof CheckoutAdmissionError) {
		const payload =
			error.payload && typeof error.payload === 'object'
				? error.payload
				: { error: { code: 'checkout_unavailable', message: error.message } };
		return json(payload, { status: error.status });
	}
	if (error instanceof ParchmentConfigError) {
		return json(
			{
				error: {
					code: 'checkout_unavailable',
					message: 'Checkout is temporarily unavailable'
				}
			},
			{ status: 503 }
		);
	}
	return null;
}

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	try {
		if (!isCookieSessionPrincipal(locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		if (request.headers.has('authorization')) {
			return json(
				{ error: 'Authorization headers are not accepted for browser checkout' },
				{ status: 401 }
			);
		}
		const requestOrigin = request.headers.get('origin');
		if (
			!requestOrigin ||
			requestOrigin !== new URL(request.url).origin ||
			!isTrustedMutationRequest(event, locals.principal)
		) {
			return json({ error: 'Cross-origin checkout requests are not allowed' }, { status: 403 });
		}
		const identity = await locals.safeGetIdentity();
		if (!identity.session || !identity.user || identity.user.id !== locals.principal.user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const { user } = locals.principal;

		const requestBody = await request.json();
		const purchaseKeys = normalizeRequestedPurchaseKeys(requestBody);
		const useAdmissions = checkoutAdmissionsEnabled();
		const requestId = normalizeRequestId(requestBody);
		if (useAdmissions && !requestId) {
			return json({ error: 'Missing or invalid checkout request ID' }, { status: 400 });
		}

		if (purchaseKeys.length === 0) {
			return json({ error: 'Missing required purchase key' }, { status: 400 });
		}

		const unknownPurchaseKey = getUnknownPurchaseKey(purchaseKeys);
		if (unknownPurchaseKey) {
			return json({ error: `Unknown purchase key: ${unknownPurchaseKey}` }, { status: 400 });
		}

		const requestedCatalogEntries = getRequestedCatalogEntries(purchaseKeys);
		const nonSelfServeEntry = requestedCatalogEntries.find(
			(entry) => !entry.selfServe || entry.billingKind !== 'stripe' || !entry.stripePriceId
		);
		if (nonSelfServeEntry) {
			return json({ error: getNonSelfServeCheckoutError(nonSelfServeEntry) }, { status: 403 });
		}

		const inRequestFamilyConflict = getInRequestFamilyConflict(requestedCatalogEntries);
		if (inRequestFamilyConflict) {
			return json(
				{
					error: `Choose only one ${inRequestFamilyConflict.publicProductName} plan per checkout. Same-family interval changes must be managed outside checkout.`
				},
				{ status: 409 }
			);
		}

		const { data: existingSubscriptions, error: existingSubscriptionsError } = await locals.supabase
			.from('billing_subscriptions')
			.select('product_family, product_key, status')
			.eq('user_id', user.id);

		if (existingSubscriptionsError) {
			console.error(
				'Error loading existing billing subscriptions for checkout authorization:',
				existingSubscriptionsError
			);
			return json({ error: 'Failed to validate existing subscriptions' }, { status: 500 });
		}

		const existingFamilyConflict = getExistingFamilyConflict({
			requestedEntries: requestedCatalogEntries,
			existingSubscriptions: (existingSubscriptions ?? []) as ExistingBillingSubscription[]
		});

		if (existingFamilyConflict) {
			return json(
				{
					error: `You already have an active ${existingFamilyConflict.publicProductName} subscription. Use subscription management to change intervals.`
				},
				{ status: 409 }
			);
		}

		const origin = request.headers.get('origin') || new URL(request.url).origin;
		const stripeCustomerId = await getStripeCustomerId(user.id);
		const stripePriceIds = normalizeCheckoutStripePriceIds(
			requestedCatalogEntries
				.map((entry) => entry.stripePriceId)
				.filter((stripePriceId): stripePriceId is string => Boolean(stripePriceId))
		);
		const purchaseFingerprint = checkoutPurchaseFingerprint(stripePriceIds);

		if (!useAdmissions) {
			const checkoutSession = await createCheckoutSession(
				stripePriceIds,
				stripeCustomerId,
				user.id,
				user.email || '',
				origin
			);
			return json({ clientSecret: checkoutSession.clientSecret });
		}

		const admission = await acquireCheckoutAdmission(event, requestId!);
		if (admission.status === 'closed') {
			return json(
				{ error: { code: 'checkout_admission_closed', message: 'Start a new checkout request' } },
				{ status: 409 }
			);
		}

		if (admission.status === 'published' && admission.stripeSessionId) {
			const replayed = await getStripe().checkout.sessions.retrieve(admission.stripeSessionId);
			if (
				!verifyPublishedCheckoutReplay(replayed, {
					ownerId: user.id,
					admissionId: admission.admissionId,
					requestId: requestId!,
					purchaseFingerprint
				})
			) {
				return json(
					{
						error: {
							code: 'checkout_replay_mismatch',
							message: 'Checkout replay could not be verified'
						}
					},
					{ status: 409 }
				);
			}
			return json({ clientSecret: replayed.client_secret, requestId });
		}

		let checkoutSession;
		try {
			checkoutSession = await createCheckoutSession(
				stripePriceIds,
				stripeCustomerId,
				user.id,
				user.email || '',
				origin,
				{
					admissionId: admission.admissionId,
					requestId: requestId!,
					purchaseFingerprint
				}
			);
		} catch (error) {
			if (isDefinitiveCheckoutCreationFailure(error)) {
				await abandonCheckoutAdmission(event, admission.admissionId);
				return json(
					{
						error: {
							code: 'stripe_checkout_rejected',
							message: error instanceof Error ? error.message : 'Stripe rejected checkout'
						}
					},
					{ status: 400 }
				);
			}
			return json(
				{
					error: {
						code: 'checkout_creation_ambiguous',
						message: 'Checkout creation may still be processing; retry this checkout',
						requestId
					}
				},
				{ status: 503 }
			);
		}

		await publishCheckoutAdmission(event, admission.admissionId, checkoutSession.id);
		return json({ clientSecret: checkoutSession.clientSecret, requestId });
	} catch (error) {
		console.error('Error creating checkout session:', error);
		const upstream = admissionFailure(error);
		if (upstream) return upstream;
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
