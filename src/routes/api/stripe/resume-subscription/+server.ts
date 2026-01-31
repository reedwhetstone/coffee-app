import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resumeSubscription } from '$lib/services/stripe';

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
