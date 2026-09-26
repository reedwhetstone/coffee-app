import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure, upstreamFailure } from '$lib/server/referenceGeneration';

export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.chart(event.params.id, event.params.revisionId);
		if (result.error || !result.data)
			return upstreamFailure(
				result.error,
				result.response?.status,
				'Unable to load the parent chart'
			);
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to load the parent chart');
	}
};
