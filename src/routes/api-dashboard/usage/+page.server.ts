import type { PageServerLoad } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { mapOwnerApiUsage } from '$lib/data/api-usage';
import { requirePageSession } from '$lib/server/pageAuth';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	requirePageSession(locals.principal);

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
