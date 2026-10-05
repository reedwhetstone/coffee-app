import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	parseRoastGenerationRequest,
	roastSourceFailure,
	routeFailure
} from '$lib/server/referenceGeneration';

/** Preview a plan built on a roast's Artisan file. Nothing is saved. */
export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const body = parseRoastGenerationRequest(await event.request.json());
		if (!body)
			return json(
				{ error: 'Choose a roast, a title, and a valid temperature adjustment' },
				{ status: 400 }
			);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.referenceProfiles.previewFromRoast(body);
		if (result.error || !result.data)
			return roastSourceFailure(
				result.error,
				result.response?.status,
				'Unable to preview this plan'
			);
		return json(result.data);
	} catch (error) {
		return routeFailure(error, 'Unable to preview this plan');
	}
};
