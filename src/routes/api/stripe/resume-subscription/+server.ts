import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resumeSubscription } from '$lib/services/stripe';
import { resolveMembershipSubscriptionManagementState } from '$lib/server/billing/subscription-management';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Ensure the user is authenticated
	const session = locals.session;
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { subscriptionId } = await request.json();

		if (!subscriptionId) {
			return json({ error: 'Subscription ID is required' }, { status: 400 });
		}

		const { data: billingSubscriptions, error: billingSubscriptionsError } = await locals.supabase
			.from('billing_subscriptions')
			.select('stripe_subscription_id, product_family, status')
			.eq('user_id', session.user.id)
			.eq('stripe_subscription_id', subscriptionId);

		if (billingSubscriptionsError) {
			throw new Error(
				`Failed to load billing subscriptions for membership management: ${billingSubscriptionsError.message}`
			);
		}

		const managementState = resolveMembershipSubscriptionManagementState({
			subscriptionId,
			billingSubscriptions: billingSubscriptions ?? []
		});

		if (!managementState.hasMatchingRows) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		if (!managementState.hasMembership) {
			return json(
				{ error: 'Membership management is only available for membership subscriptions.' },
				{ status: 403 }
			);
		}

		if (managementState.hasActiveOtherFamilies) {
			return json(
				{
					error:
						'Membership resume is unavailable for bundled subscriptions that also include API or Parchment Intelligence products.'
				},
				{ status: 409 }
			);
		}

		const success = await resumeSubscription(subscriptionId);

		if (!success) {
			return json({ error: 'Failed to resume subscription' }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error resuming subscription:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
