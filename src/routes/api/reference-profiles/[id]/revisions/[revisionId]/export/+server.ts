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
		const result = await client.referenceProfiles.exportGenerated(
			event.params.id,
			event.params.revisionId
		);
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to download this plan');
		const file = result.data.data;
		return new Response(file.fileContent, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Content-Disposition': 'attachment; filename="Purveyors-reference.alog"',
				'Cache-Control': 'private, no-store',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (error) {
		return routeFailure(error, 'Unable to download this plan');
	}
};
