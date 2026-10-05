import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure, upstreamFailure } from '$lib/server/referenceGeneration';

// Parchment returns at most this many roasts, newest first, with counts for the rest.
const CANDIDATE_LIMIT = 50;

/** The roasts a plan can start from: those whose Artisan file is on record. */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.roastCandidates({ limit: CANDIDATE_LIMIT });
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to load roasts');
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to load roasts');
	}
};
