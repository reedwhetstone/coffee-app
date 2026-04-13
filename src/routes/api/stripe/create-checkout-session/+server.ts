import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCheckoutSession, getStripeCustomerId } from '$lib/services/stripe';
import { getBillingCatalogEntry, type BillingCatalogEntry } from '$lib/server/billing/catalog';

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

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const requestBody = await request.json();
		const purchaseKeys = normalizeRequestedPurchaseKeys(requestBody);

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
		const stripePriceIds = requestedCatalogEntries
			.map((entry) => entry.stripePriceId)
			.filter((stripePriceId): stripePriceId is string => Boolean(stripePriceId));

		const clientSecret = await createCheckoutSession(
			stripePriceIds,
			stripeCustomerId,
			user.id,
			user.email || '',
			origin
		);

		if (!clientSecret) {
			return json({ error: 'Failed to create checkout session' }, { status: 500 });
		}

		return json({ clientSecret });
	} catch (error) {
		console.error('Error creating checkout session:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
