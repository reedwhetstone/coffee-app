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
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey) return json({ error: 'Idempotency-Key is required' }, { status: 400 });
		const body = parseGenerationRequest(await event.request.json());
		if (!body)
			return json({ error: 'Choose a title and valid temperature adjustment' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.generate(
			event.params.id,
			event.params.revisionId,
			body,
			idempotencyKey
		);
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to save this plan');
		return json(result.data, { status: result.response.status });
	} catch (error) {
		return routeFailure(error, 'Unable to save this plan');
	}
};
