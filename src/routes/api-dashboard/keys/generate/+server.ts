import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createApiKey } from '$lib/server/apiAuth';
import { hasRole } from '$lib/types/auth.types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Get authenticated session
		const { session, user, role } = await locals.safeGetSession();

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
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json(
				{
					success: false,
					error: 'API key name is required'
				},
				{ status: 400 }
			);
		}

		// Create the API key
		const result = await createApiKey(user.id, name.trim());

		if (!result.success) {
			return json(
				{
					success: false,
					error: result.error || 'Failed to create API key'
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			apiKey: result.apiKey,
			message: 'API key created successfully'
		});
	} catch (error) {
		console.error('Error creating API key:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
