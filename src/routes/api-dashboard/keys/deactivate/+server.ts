import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deactivateApiKey } from '$lib/server/apiAuth';
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Get authenticated session
		const { session, user } = await locals.safeGetSession();

		// Allow authenticated users (free tier defaults to api_viewer)
		if (!session || !user) {
			return json(
				{
					success: false,
					error: 'Authentication required'
				},
				{ status: 401 }
			);
		}

		// Parse request body
		const { keyId } = await request.json();

		if (!keyId || typeof keyId !== 'string') {
			return json(
				{
					success: false,
					error: 'API key ID is required'
				},
				{ status: 400 }
			);
		}

		// Deactivate the API key (ensures user owns the key)
		const success = await deactivateApiKey(user.id, keyId);

		if (!success) {
			return json(
				{
					success: false,
					error: 'Failed to deactivate API key'
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			message: 'API key deactivated successfully'
		});
	} catch (error) {
		console.error('Error deactivating API key:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
