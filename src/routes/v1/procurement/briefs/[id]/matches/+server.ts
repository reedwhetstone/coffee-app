import type { RequestHandler } from './$types';
import { buildSourcingBriefMatchesResponse } from '$lib/server/procurement/sourcingBriefs';

export const GET: RequestHandler = async (event) => {
	return buildSourcingBriefMatchesResponse(event, event.params.id, {
		requestPath: '/v1/procurement/briefs/:id/matches'
	});
};
