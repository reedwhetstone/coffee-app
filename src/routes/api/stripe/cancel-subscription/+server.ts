import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cancelSubscription } from '$lib/services/stripe';

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

		const success = await cancelSubscription(subscriptionId);

		if (!success) {
			return json({ error: 'Failed to cancel subscription' }, { status: 500 });
		}

		return json({ success: true });
	} catch (error: any) {
		console.error('Error canceling subscription:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
