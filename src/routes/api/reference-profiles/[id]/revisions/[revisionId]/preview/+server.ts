import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	parseGenerationRequest,
	routeFailure,
	upstreamFailure
} from '$lib/server/referenceGeneration';

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const body = parseGenerationRequest(await event.request.json());
		if (!body)
			return json({ error: 'Choose a title and valid temperature adjustment' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.preview(
			event.params.id,
			event.params.revisionId,
			body
		);
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to preview this plan');
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to preview this plan');
	}
};
