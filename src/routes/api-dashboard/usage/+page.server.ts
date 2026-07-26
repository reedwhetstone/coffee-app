import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { mapOwnerApiUsage } from '$lib/data/api-usage';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	// Get authenticated session
	const { session, user } = await locals.safeGetSession();

	// Allow authenticated users (free tier defaults to viewer)
	if (!session || !user) {
		throw redirect(303, '/');
	}

	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.apiUsage.get({ days: 30, recentPerKey: 25 });

		if (error || !data || !response.ok) {
			console.error('Failed to load API usage analytics:', response.status);
			return {
				error: 'Failed to load usage analytics',
				apiKeys: [],
				usageData: [],
				dailySummary: [],
				currentStats: null,
				bounds: null
			};
		}

		return mapOwnerApiUsage(data);
	} catch (error) {
		console.error('Error loading usage analytics:', error);
		return {
			error: 'Failed to load usage analytics',
			apiKeys: [],
			usageData: [],
			dailySummary: [],
			currentStats: null,
			bounds: null
		};
	}
};
