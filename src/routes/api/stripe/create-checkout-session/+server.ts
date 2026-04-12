import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCheckoutSession } from '$lib/services/stripe';
import { getBillingCatalogEntry } from '$lib/server/billing/catalog';

function isPurchaseAuthorized(
	billingCatalogEntry: ReturnType<typeof getBillingCatalogEntry>,
	role: App.Locals['role']
): boolean {
	if (!billingCatalogEntry) {
		return false;
	}

	if (billingCatalogEntry.productFamily === 'membership') {
		return role !== 'member' && role !== 'admin';
	}

	return true;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Verify that the user is authenticated
		const { user, role } = await locals.safeGetSession();
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const requestBody = await request.json();
		const purchaseKey =
			typeof requestBody?.purchaseKey === 'string' ? requestBody.purchaseKey.trim() : '';

		if (!purchaseKey) {
			return json({ error: 'Missing required purchase key' }, { status: 400 });
		}

		const billingCatalogEntry = getBillingCatalogEntry(purchaseKey);

		if (!billingCatalogEntry) {
			return json({ error: 'Unknown purchase key' }, { status: 400 });
		}

		if (!isPurchaseAuthorized(billingCatalogEntry, role)) {
			return json(
				{
					error:
						'You already have membership access. Use subscription management for existing memberships.'
				},
				{ status: 403 }
			);
		}

		// Get the origin for the return URL
		const origin = request.headers.get('origin') || new URL(request.url).origin;

		// Create a checkout session using our service
		const clientSecret = await createCheckoutSession(
			billingCatalogEntry.stripePriceId,
			null, // We don't pass customerId here since we want to capture email for new customers
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
