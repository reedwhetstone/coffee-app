import type { PageServerLoad } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { mapOwnerApiUsage } from '$lib/data/api-usage';
import { requirePageSession } from '$lib/server/pageAuth';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	requirePageSession(locals.principal);

	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.apiUsage.get({ days: 30, recentPerKey: 10 });

		if (error || !data || !response.ok) {
			console.error('Failed to load API usage:', response.status);
			return {
				apiKeys: [],
				error: 'Failed to load API usage',
				usageStats: null
			};
		}

		const mapped = mapOwnerApiUsage(data);
		return {
			apiKeys: mapped.apiKeys,
			usageStats: mapped.usageStats
		};
	} catch (error) {
		console.error('Error loading API usage:', error);
		return {
			apiKeys: [],
			error: 'Failed to load API usage',
			usageStats: null
		};
	}
};
